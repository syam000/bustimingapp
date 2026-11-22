package sg.bustiming.app.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class WatchedStop(val code: String, val desc: String = "", val road: String = "")

/** Persists the user's watched stops in plain SharedPreferences as JSON. */
class WatchedStopsStore(context: Context) {
    private val prefs = context.getSharedPreferences("bustiming", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    fun load(): List<WatchedStop> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return try {
            json.decodeFromString<List<WatchedStop>>(raw)
                .filter { it.code.isNotBlank() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun save(stops: List<WatchedStop>) {
        prefs.edit().putString(KEY, json.encodeToString(stops)).apply()
    }

    private companion object {
        const val KEY = "watched_stops_v1"
    }
}
