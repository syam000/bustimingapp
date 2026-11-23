package sg.bustiming.app

import android.app.Application
import android.location.Location
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import sg.bustiming.app.data.ArrivalsDto
import sg.bustiming.app.data.BackendApiClient
import sg.bustiming.app.data.BusStopDto
import sg.bustiming.app.data.LocationProvider
import sg.bustiming.app.data.NearbyStopDto
import sg.bustiming.app.data.WatchedStop
import sg.bustiming.app.data.WatchedStopsStore

private const val REFRESH_MILLIS = 15_000L
private const val SEARCH_DEBOUNCE_MILLIS = 300L

/** UI state for one watched stop's arrivals. */
sealed interface ArrivalsUiState {
    data object Loading : ArrivalsUiState
    data class Loaded(val response: ArrivalsDto) : ArrivalsUiState
    data class Failed(val message: String) : ArrivalsUiState
}

/** UI state for the "nearby stops" map screen. */
sealed interface NearbyUiState {
    data object Idle : NearbyUiState
    data object NeedsPermission : NearbyUiState
    data object Loading : NearbyUiState
    data class Loaded(val location: Location, val stops: List<NearbyStopDto>) : NearbyUiState
    data class Failed(val message: String) : NearbyUiState
}

class BusTimingViewModel(application: Application) : AndroidViewModel(application) {

    private val api = BackendApiClient()
    private val store = WatchedStopsStore(application)
    private val locationProvider = LocationProvider(application)

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val _searchResults = MutableStateFlow<List<BusStopDto>?>(null)
    val searchResults: StateFlow<List<BusStopDto>?> = _searchResults.asStateFlow()

    private val _watched = MutableStateFlow<List<WatchedStop>>(store.load())
    val watched: StateFlow<List<WatchedStop>> = _watched.asStateFlow()

    private val _arrivalsByStop = MutableStateFlow<Map<String, ArrivalsUiState>>(emptyMap())
    val arrivalsByStop: StateFlow<Map<String, ArrivalsUiState>> = _arrivalsByStop.asStateFlow()

    private val _nearby = MutableStateFlow<NearbyUiState>(NearbyUiState.Idle)
    val nearby: StateFlow<NearbyUiState> = _nearby.asStateFlow()

    private val pollingJobs = mutableMapOf<String, Job>()
    private var searchJob: Job? = null
    private var nearbyJob: Job? = null

    init {
        _watched.value.forEach { startPolling(it.code) }
    }

    fun onQueryChange(newQuery: String) {
        _query.value = newQuery
        searchJob?.cancel()
        val q = newQuery.trim()
        if (q.isEmpty()) {
            _searchResults.value = null
            return
        }
        // Debounced so fast typing doesn't fire a backend call per keystroke
        // - keeps this feature's mobile data use to one small request.
        searchJob = viewModelScope.launch {
            delay(SEARCH_DEBOUNCE_MILLIS)
            _searchResults.value = try {
                api.searchStops(q).stops
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    fun addStop(stop: BusStopDto) = addStopEntry(stop.code, stop.desc, stop.road)

    fun addNearbyStop(stop: NearbyStopDto) = addStopEntry(stop.code, stop.desc, stop.road)

    private fun addStopEntry(code: String, desc: String, road: String) {
        if (_watched.value.any { it.code == code }) return
        _watched.value = _watched.value + WatchedStop(code, desc, road)
        store.save(_watched.value)
        _query.value = ""
        _searchResults.value = null
        startPolling(code)
    }

    fun removeStop(code: String) {
        pollingJobs.remove(code)?.cancel()
        _watched.value = _watched.value.filterNot { it.code == code }
        _arrivalsByStop.value = _arrivalsByStop.value - code
        store.save(_watched.value)
    }

    /** Call when the map screen becomes visible (or the user taps retry/refresh on it). */
    fun loadNearbyStops() {
        if (!locationProvider.hasPermission()) {
            _nearby.value = NearbyUiState.NeedsPermission
            return
        }
        nearbyJob?.cancel()
        nearbyJob = viewModelScope.launch {
            _nearby.value = NearbyUiState.Loading
            val location = locationProvider.getCurrentLocation()
            if (location == null) {
                _nearby.value = NearbyUiState.Failed("Couldn't get your location. Is GPS/location turned on?")
                return@launch
            }
            _nearby.value = try {
                val response = api.getNearbyStops(location.latitude, location.longitude)
                NearbyUiState.Loaded(location, response.stops)
            } catch (e: Exception) {
                NearbyUiState.Failed(e.message ?: "Failed to fetch nearby stops.")
            }
        }
    }

    /** Call after a location-permission request completes, so the map screen can retry. */
    fun onLocationPermissionResult(granted: Boolean) {
        if (granted) loadNearbyStops() else _nearby.value = NearbyUiState.NeedsPermission
    }

    private fun startPolling(code: String) {
        pollingJobs[code]?.cancel()
        pollingJobs[code] = viewModelScope.launch {
            while (true) {
                _arrivalsByStop.value = _arrivalsByStop.value + (code to ArrivalsUiState.Loading)
                val state = try {
                    ArrivalsUiState.Loaded(api.getArrivals(code))
                } catch (e: Exception) {
                    ArrivalsUiState.Failed(e.message ?: "Failed to fetch arrival data.")
                }
                _arrivalsByStop.value = _arrivalsByStop.value + (code to state)
                delay(REFRESH_MILLIS)
            }
        }
    }
}
