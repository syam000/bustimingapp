package sg.bustiming.app

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import sg.bustiming.app.data.NearbyStopDto
import kotlin.math.roundToInt

private const val DEFAULT_ZOOM = 15.0

/**
 * Shows the phone's current location (via plain android.location - no
 * Google Play services) and nearby bus stops on an OpenStreetMap view
 * (osmdroid - free, no API key), plus a plain list below it to add any of
 * them to your watched stops.
 */
@Composable
fun MapScreen(viewModel: BusTimingViewModel) {
    val state by viewModel.nearby.collectAsState()

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { results ->
        viewModel.onLocationPermissionResult(results.values.any { it })
    }

    LaunchedEffect(Unit) { viewModel.loadNearbyStops() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Nearby stops", style = MaterialTheme.typography.headlineSmall)

        when (val s = state) {
            is NearbyUiState.Idle, is NearbyUiState.Loading ->
                Text("Loading…", modifier = Modifier.padding(top = 12.dp))

            is NearbyUiState.NeedsPermission -> Column(modifier = Modifier.padding(top = 12.dp)) {
                Text("Needs location permission to show your position and nearby stops.")
                Button(
                    modifier = Modifier.padding(top = 8.dp),
                    onClick = {
                        permissionLauncher.launch(
                            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                        )
                    },
                ) { Text("Grant location permission") }
            }

            is NearbyUiState.Failed -> Column(modifier = Modifier.padding(top = 12.dp)) {
                Text("⚠ ${s.message}")
                Button(modifier = Modifier.padding(top = 8.dp), onClick = { viewModel.loadNearbyStops() }) {
                    Text("Retry")
                }
            }

            is NearbyUiState.Loaded -> Column(modifier = Modifier.fillMaxSize()) {
                OsmMapView(
                    userLat = s.location.latitude,
                    userLng = s.location.longitude,
                    stops = s.stops,
                    modifier = Modifier.fillMaxWidth().aspectRatio(1f).padding(top = 12.dp),
                )

                if (s.stops.isEmpty()) {
                    Text(
                        "No bus stops within range. Try fetch-stops on the backend for full coverage.",
                        modifier = Modifier.padding(top = 12.dp),
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.padding(top = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(s.stops, key = { it.code }) { stop -> NearbyStopRow(stop, onAdd = { viewModel.addNearbyStop(stop) }) }
                    }
                }
            }
        }
    }
}

@Composable
private fun NearbyStopRow(stop: NearbyStopDto, onAdd: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text("${stop.code}  ${stop.desc}  ·  ${formatDistance(stop.distanceKm)}", style = MaterialTheme.typography.bodyLarge)
        Text(stop.road, style = MaterialTheme.typography.bodySmall)
        Button(onClick = onAdd, modifier = Modifier.padding(top = 4.dp)) { Text("Add") }
    }
}

private fun formatDistance(km: Double): String =
    if (km < 1.0) "${(km * 1000).roundToInt()}m" else "${(km * 10).roundToInt() / 10.0}km"

@Composable
private fun OsmMapView(userLat: Double, userLng: Double, stops: List<NearbyStopDto>, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val mapView = remember { MapView(context) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            mapView.onDetach()
        }
    }

    AndroidView(
        modifier = modifier,
        factory = { mapView },
        update = { view ->
            view.overlays.clear()
            val userPoint = GeoPoint(userLat, userLng)
            view.controller.setZoom(DEFAULT_ZOOM)
            view.controller.setCenter(userPoint)

            view.overlays.add(
                Marker(view).apply {
                    position = userPoint
                    title = "You are here"
                },
            )
            stops.forEach { stop ->
                view.overlays.add(
                    Marker(view).apply {
                        position = GeoPoint(stop.lat, stop.lng)
                        title = "${stop.code} - ${stop.desc}"
                    },
                )
            }
            view.invalidate()
        },
    )
}
