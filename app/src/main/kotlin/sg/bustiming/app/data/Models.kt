package sg.bustiming.app.data

import kotlinx.serialization.Serializable

@Serializable
data class ConfigDto(val mode: String)

@Serializable
data class BusStopDto(val code: String, val road: String = "", val desc: String = "")

@Serializable
data class StopsResponseDto(val count: Int = 0, val stops: List<BusStopDto> = emptyList())

@Serializable
data class ServiceDto(val no: String, val operator: String = "", val etas: List<String> = emptyList())

@Serializable
data class ArrivalsDto(val stop: String, val mode: String, val services: List<ServiceDto> = emptyList())

@Serializable
data class ErrorDto(val error: String? = null)

@Serializable
data class NearbyStopDto(
    val code: String,
    val road: String = "",
    val desc: String = "",
    val lat: Double,
    val lng: Double,
    val distanceKm: Double,
)

@Serializable
data class NearbyResponseDto(
    val count: Int = 0,
    val radiusKm: Double = 0.0,
    val stops: List<NearbyStopDto> = emptyList(),
)
