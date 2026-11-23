package sg.bustiming.app.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Plain framework location lookup (android.location) - deliberately not
 * Google Play services' FusedLocationProviderClient, to avoid pulling in
 * that extra dependency for a "keep it simple" local project.
 */
class LocationProvider(private val context: Context) {

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /** Returns the last known or a freshly-requested location, or null if permission/providers are unavailable. */
    @SuppressLint("MissingPermission") // callers must check hasPermission() first
    suspend fun getCurrentLocation(): Location? {
        if (!hasPermission()) return null
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { runCatching { manager.isProviderEnabled(it) }.getOrDefault(false) }
        if (providers.isEmpty()) return null

        // A recent last-known fix is usually good enough and instant - only
        // fall back to waiting for a fresh update if none is available.
        val lastKnown = providers.mapNotNull { manager.getLastKnownLocation(it) }.maxByOrNull { it.time }
        if (lastKnown != null) return lastKnown

        return suspendCancellableCoroutine { cont ->
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    manager.removeUpdates(this)
                    if (cont.isActive) cont.resume(location)
                }
            }
            manager.requestLocationUpdates(providers.first(), 0L, 0f, listener, Looper.getMainLooper())
            cont.invokeOnCancellation { manager.removeUpdates(listener) }
        }
    }
}
