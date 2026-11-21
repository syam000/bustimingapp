package sg.bustiming.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import sg.bustiming.app.data.ArrivalsDto
import sg.bustiming.app.data.BusStopDto
import sg.bustiming.app.data.ServiceDto
import sg.bustiming.app.data.WatchedStop
import java.time.Instant
import java.time.temporal.ChronoUnit

class MainActivity : ComponentActivity() {
    private val viewModel: BusTimingViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    BusTimingScreen(viewModel)
                }
            }
        }
    }
}

/**
 * The entire app: one screen, no navigation. A search field, matching
 * stop results below it (from the backend's small bus-stop dataset), and
 * the list of watched stops with their live (or mock) arrival times, all
 * served by this app's own backend - the phone never calls LTA directly.
 */
@Composable
fun BusTimingScreen(viewModel: BusTimingViewModel) {
    val query by viewModel.query.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val watched by viewModel.watched.collectAsState()
    val arrivalsByStop by viewModel.arrivalsByStop.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("SG Bus Timing", style = MaterialTheme.typography.headlineSmall)

        OutlinedTextField(
            value = query,
            onValueChange = viewModel::onQueryChange,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            placeholder = { Text("Search stop code, road, or place") },
            singleLine = true,
        )

        searchResults?.let { results ->
            Column(modifier = Modifier.padding(top = 8.dp)) {
                if (results.isEmpty()) {
                    Text("No matching bus stops found.", style = MaterialTheme.typography.bodyMedium)
                } else {
                    results.forEach { stop -> SearchResultRow(stop, onClick = { viewModel.addStop(stop) }) }
                }
            }
        }

        Text(
            "Watched stops",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 20.dp, bottom = 8.dp),
        )

        if (watched.isEmpty()) {
            Text(
                "No stops added yet. Search above to add one.",
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(watched, key = { it.code }) { stop ->
                    WatchedStopCard(
                        stop = stop,
                        state = arrivalsByStop[stop.code],
                        onRemove = { viewModel.removeStop(stop.code) },
                    )
                }
            }
        }
    }
}

@Composable
private fun SearchResultRow(stop: BusStopDto, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
    ) {
        Text("${stop.code}  ${stop.desc}", style = MaterialTheme.typography.bodyLarge)
        Text(stop.road, style = MaterialTheme.typography.bodySmall)
        Button(onClick = onClick, modifier = Modifier.padding(top = 4.dp)) { Text("Add") }
    }
}

@Composable
private fun WatchedStopCard(stop: WatchedStop, state: ArrivalsUiState?, onRemove: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text(stop.desc.ifBlank { "Bus Stop ${stop.code}" }, style = MaterialTheme.typography.titleSmall)
                    Text("${stop.code}${if (stop.road.isNotBlank()) " · ${stop.road}" else ""}", style = MaterialTheme.typography.bodySmall)
                }
                Button(onClick = onRemove) { Text("Remove") }
            }

            when (state) {
                null, is ArrivalsUiState.Loading -> Text("Loading…", modifier = Modifier.padding(top = 8.dp))
                is ArrivalsUiState.Failed -> Text("⚠ ${state.message}", modifier = Modifier.padding(top = 8.dp))
                is ArrivalsUiState.Loaded -> ServicesList(state.response)
            }
        }
    }
}

@Composable
private fun ServicesList(response: ArrivalsDto) {
    Column(modifier = Modifier.padding(top = 8.dp)) {
        Text(
            if (response.mode == "live") "Live data" else "Mock data",
            style = MaterialTheme.typography.labelSmall,
        )
        if (response.services.isEmpty()) {
            Text("No bus services found for this stop.")
        } else {
            response.services.forEach { service -> ServiceRow(service) }
        }
    }
}

@Composable
private fun ServiceRow(service: ServiceDto) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(service.no, style = MaterialTheme.typography.bodyLarge)
        Text(
            service.etas.mapNotNull(::etaLabel).ifEmpty { listOf("No data") }.joinToString("   "),
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

private fun etaLabel(estimatedArrival: String): String? {
    val arrival = try {
        Instant.parse(estimatedArrival)
    } catch (_: Exception) {
        return null
    }
    val mins = ChronoUnit.MINUTES.between(Instant.now(), arrival).coerceAtLeast(0)
    return if (mins == 0L) "Arr" else "${mins}m"
}
