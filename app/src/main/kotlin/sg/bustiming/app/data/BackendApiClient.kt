package sg.bustiming.app.data

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.Json
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import sg.bustiming.app.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Thrown when the backend returns a non-2xx response. */
class BackendApiError(message: String, val status: Int) : Exception(message)

/**
 * Talks to this app's own small backend (see /backend in the repo) -
 * never to LTA DataMall directly. The backend holds the API key and sends
 * back a deliberately trimmed JSON shape to keep mobile data usage low.
 */
class BackendApiClient(
    private val baseUrl: String = BuildConfig.BACKEND_BASE_URL,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .callTimeout(10, TimeUnit.SECONDS)
        .build(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun getConfig(): ConfigDto = get("$baseUrl/api/config")

    suspend fun searchStops(query: String): StopsResponseDto =
        get("$baseUrl/api/stops?q=${java.net.URLEncoder.encode(query, "UTF-8")}")

    suspend fun getArrivals(stopCode: String): ArrivalsDto =
        get("$baseUrl/api/arrivals?stop=${java.net.URLEncoder.encode(stopCode, "UTF-8")}")

    private suspend inline fun <reified T> get(url: String): T {
        val body = request(url)
        return json.decodeFromString(body)
    }

    private suspend fun request(url: String): String =
        suspendCancellableCoroutine { cont ->
            val call = client.newCall(Request.Builder().url(url).build())
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    cont.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        val bodyString = response.body?.string().orEmpty()
                        if (!response.isSuccessful) {
                            val message = try {
                                json.decodeFromString<ErrorDto>(bodyString).error
                            } catch (_: Exception) {
                                null
                            } ?: "Backend request failed (${response.code})"
                            cont.resumeWithException(BackendApiError(message, response.code))
                        } else {
                            cont.resume(bodyString)
                        }
                    }
                }
            })
            cont.invokeOnCancellation { call.cancel() }
        }
}
