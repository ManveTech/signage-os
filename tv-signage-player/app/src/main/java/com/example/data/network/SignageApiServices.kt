package com.example.data.network

import com.squareup.moshi.JsonClass
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Url

@JsonClass(generateAdapter = true)
data class PairingRequest(
    val hardwareUuid: String
)

@JsonClass(generateAdapter = true)
data class PairingResponse(
    val screenId: String,
    val pairingCode: String,
    val status: String,
    val pocketbaseUrl: String? = null
)

@JsonClass(generateAdapter = true)
data class HeartbeatRequest(
    val hardwareUuid: String,
    val cpuTemp: Double,
    val currentPlayingAsset: String?,
    val storageUsedBytes: Long,
    val storageAvailableBytes: Long
)

@JsonClass(generateAdapter = true)
data class PocketBaseScreenResponse(
    val id: String,
    val status: String,
    val playlist: String? = null,
    val playlistId: String? = null,
    val name: String? = null,
    val schedulePlaylist: String? = null,
    val scheduleDate: String? = null,
    val scheduleTime: String? = null,
    val clear_cache: Boolean? = null,
    val volume: Int? = null,
    val force_sync: Boolean? = null,
    val restart_playlist: Boolean? = null,
    val whiteLabel: Boolean? = null,
    val websiteLogo: String? = null,
    val websiteName: String? = null
)

@JsonClass(generateAdapter = true)
data class PocketBasePlaylistAsset(
    val id: String,
    val url: String,
    val filename: String,
    val mediaType: String, // "image", "video", or "youtube"
    val duration: Int = 10,
    val checksum: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    val fileSize: String? = null,
    val fileSizeBytes: Long? = null,
    val mimeType: String? = null,
    val youtubeVideoId: String? = null
)

@JsonClass(generateAdapter = true)
data class PocketBasePlaylistSlide(
    val id: String,
    val mediaId: String,
    val duration: Int = 10,
    val layoutType: String = "single",
    val secondMediaId: String? = null
)

@JsonClass(generateAdapter = true)
data class PocketBasePlaylistResponse(
    val id: String,
    val name: String? = null,
    val description: String? = null,
    val active: Boolean? = null,
    // Pocketbase might store assets as an array of JSON objects or individual records
    val assetsJson: List<PocketBasePlaylistAsset>? = null,
    // File names managed by PB's native files storage
    val files: List<String>? = null,
    val mediaIds: List<String>? = null,
    // Slide sequence with per-slide durations and order
    val slides: List<PocketBasePlaylistSlide>? = null,
    // Playlist playback settings
    val orientation: String? = null,       // "horizontal" | "vertical"
    val shuffle: Boolean? = null,          // Shuffle slide order
    val loop: Boolean? = null,             // Loop playlist
    val transition: String? = null,        // Slide transition effect
    val volume: Double? = null,             // Playback volume (0-100)
    val widgetType: String? = null,
    val widgetPlacement: String? = null,
    val widgetLink: String? = null,
    val whiteLabel: Boolean? = null,
    val websiteLogo: String? = null,
    val websiteName: String? = null
)

@JsonClass(generateAdapter = true)
data class PocketBaseMediaItemResponse(
    val id: String,
    val title: String,
    val type: String, // "video", "image", or "youtube"
    val thumbnail: String, // contains the media URL
    val duration: Int = 10,
    val file: String? = null,
    val checksum: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    val mimeType: String? = null,
    val fileSize: String? = null,
    val fileSizeBytes: Long? = null,
    val youtubeVideoId: String? = null
)

interface SignageApiService {
    @POST
    suspend fun getPairingCode(
        @Url url: String,
        @Body request: PairingRequest
    ): PairingResponse

    @POST
    suspend fun sendHeartbeat(
        @Url url: String,
        @Body request: HeartbeatRequest
    ): Response<Unit>

    @POST
    suspend fun reportOffline(
        @Url url: String,
        @Body fields: Map<String, String>
    ): Response<Unit>

    @POST
    suspend fun postLog(
        @Url url: String,
        @Body fields: Map<String, String>
    ): Response<Unit>

    @GET
    suspend fun getScreenRecord(
        @Url url: String
    ): PocketBaseScreenResponse

    @retrofit2.http.PATCH
    suspend fun updateScreenRecord(
        @Url url: String,
        @Body fields: @JvmSuppressWildcards Map<String, Any?>
    ): PocketBaseScreenResponse

    @GET
    suspend fun getPlaylistRecord(
        @Url url: String
    ): PocketBasePlaylistResponse

    @GET
    suspend fun getPlaylistList(
        @Url url: String
    ): PocketBasePlaylistListResponse

    @GET
    suspend fun getMediaItemRecord(
        @Url url: String
    ): PocketBaseMediaItemResponse
}

@JsonClass(generateAdapter = true)
data class PocketBasePlaylistListResponse(
    val items: List<PocketBasePlaylistResponse>
)
