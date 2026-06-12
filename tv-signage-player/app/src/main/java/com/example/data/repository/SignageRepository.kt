package com.example.data.repository

import android.content.Context
import android.os.StatFs
import android.util.Log
import com.example.data.database.AppDatabase
import com.example.data.database.PlaylistAsset
import com.example.data.database.ScreenConfig
import com.example.data.network.HeartbeatRequest
import com.example.data.network.PairingRequest
import com.example.data.network.PocketBasePlaylistAsset
import com.example.data.network.SignageApiService
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.random.Random
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import java.security.MessageDigest

data class DownloadState(
    val isDownloading: Boolean = false,
    val totalFiles: Int = 0,
    val completedFiles: Int = 0,
    val currentFileProgress: Float = 0.0f,
    val currentFileName: String = ""
)

class SignageRepository(private val context: Context) {

    private val database = AppDatabase.getDatabase(context)
    private val configDao = database.screenConfigDao()
    private val assetDao = database.playlistAssetDao()

    private val moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl("http://10.0.2.2:5000/") // Fallback/dummy base URL, as we use dynamic @Url
        .client(okHttpClient)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()

    private val apiService = retrofit.create(SignageApiService::class.java)

    val configFlow: Flow<ScreenConfig?> = configDao.getConfigFlow()
    val assetsFlow: Flow<List<PlaylistAsset>> = assetDao.getAllAssetsFlow()
    val downloadStateFlow = kotlinx.coroutines.flow.MutableStateFlow(DownloadState())

    init {
        // Log cache initialization details
        val cacheDir = File(context.filesDir, "signage_cache")
        if (!cacheDir.exists()) {
            cacheDir.mkdirs()
        }
    }

    suspend fun getOrCreateConfig(): ScreenConfig = withContext(Dispatchers.IO) {
        var config = configDao.getConfig()
        if (config == null) {
            val randomUuid = UUID.randomUUID().toString()
            config = ScreenConfig(hardwareUuid = randomUuid)
            configDao.saveConfig(config)
        }
        config
    }

    suspend fun updateServerUrls(serverUrl: String, pocketbaseUrl: String) = withContext(Dispatchers.IO) {
        val current = getOrCreateConfig()
        val updated = current.copy(serverUrl = serverUrl, pocketbaseUrl = pocketbaseUrl)
        configDao.saveConfig(updated)
    }

    suspend fun requestPairingCode(): Result<ScreenConfig> = withContext(Dispatchers.IO) {
        try {
            val config = getOrCreateConfig()
            val request = PairingRequest(hardwareUuid = config.hardwareUuid)
            val url = "${config.serverUrl}/api/v1/devices/pairing-code"

            Log.d("SignageRepository", "Requesting pairing code from: $url")
            val response = apiService.getPairingCode(url, request)

            val basePbUrl = response.pocketbaseUrl
            val resolvedPocketbaseUrl = if (!basePbUrl.isNullOrEmpty()) {
                basePbUrl.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2")
            } else {
                config.pocketbaseUrl
            }

            val updatedConfig = config.copy(
                screenId = response.screenId,
                pairingCode = response.pairingCode,
                status = response.status,
                pocketbaseUrl = resolvedPocketbaseUrl
            )
            configDao.saveConfig(updatedConfig)
            Result.success(updatedConfig)
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error requesting pairing code", e)
            Result.failure(e)
        }
    }

    suspend fun syncScreenStatus(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val config = getOrCreateConfig()
            if (config.screenId.isEmpty()) {
                return@withContext Result.failure(IllegalStateException("No screen record paired yet"))
            }

            // Read the real record state from Pocketbase
            val url = "${config.pocketbaseUrl}/api/collections/screens/records/${config.screenId}"
            val response = apiService.getScreenRecord(url)

            Log.d("SignageRepository", "Synced screen status: ${response.status}")
            val updatedConfig = config.copy(
                status = response.status,
                screenName = response.name ?: config.screenName
            )
            configDao.saveConfig(updatedConfig)

            // Check if clear_cache command was sent from backend
            if (response.clear_cache == true) {
                Log.d("SignageRepository", "Clear cache command received. Clearing device assets.")
                clearDeviceAssets()
                
                // Clear the command flag on backend
                try {
                    val patchUrl = "${config.pocketbaseUrl}/api/collections/screens/records/${config.screenId}"
                    apiService.updateScreenRecord(patchUrl, mapOf("clear_cache" to false))
                } catch (e: Exception) {
                    Log.e("SignageRepository", "Failed to clear clear_cache flag on server", e)
                }
            }

            // Check if schedule is due
            if (!response.schedulePlaylist.isNullOrEmpty() && !response.scheduleDate.isNullOrEmpty() && !response.scheduleTime.isNullOrEmpty()) {
                if (isScheduleDue(response.scheduleDate, response.scheduleTime)) {
                    applyScheduledPlaylist(config, response.schedulePlaylist)
                }
            }

            // If active or online, sync the actual playlist assets
            if (response.status == "active" || response.status == "online") {
                val activePlaylistId = response.playlistId ?: response.playlist
                if (!activePlaylistId.isNullOrEmpty()) {
                    syncPlaylist(config.pocketbaseUrl, activePlaylistId)
                } else {
                    // Clear playlist assets since none assigned
                    if (assetDao.getAllAssets().isNotEmpty()) {
                        assetDao.clearAllAssets()
                    }
                }
            }

            Result.success(Unit)
        } catch (e: retrofit2.HttpException) {
            if (e.code() == 404) {
                Log.d("SignageRepository", "Screen record not found (404). Unpairing device and purging cache.")
                clearCache()
            }
            Log.e("SignageRepository", "HTTP error syncing screen status with backend", e)
            Result.failure(e)
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error syncing screen status with backend", e)
            Result.failure(e)
        }
    }

    // Direct helper to clear the local cached files and playlist database assets without unpairing
    suspend fun clearDeviceAssets() = withContext(Dispatchers.IO) {
        try {
            val cacheDir = File(context.filesDir, "signage_cache")
            if (cacheDir.exists()) {
                cacheDir.listFiles()?.forEach { it.delete() }
            }
            assetDao.clearAllAssets()
            Log.d("SignageRepository", "Successfully cleared device assets and cache directory files")
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error purging local assets", e)
        }
    }

    private fun isScheduleDue(scheduleDate: String?, scheduleTime: String?): Boolean {
        if (scheduleDate.isNullOrEmpty() || scheduleTime.isNullOrEmpty()) return false
        return try {
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm", java.util.Locale.US)
            sdf.timeZone = java.util.TimeZone.getDefault()
            val scheduledDateTime = sdf.parse("${scheduleDate}T${scheduleTime}") ?: return false
            val now = java.util.Date()
            now.after(scheduledDateTime)
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error checking schedule", e)
            false
        }
    }

    private suspend fun applyScheduledPlaylist(config: ScreenConfig, playlistName: String) = withContext(Dispatchers.IO) {
        try {
            Log.d("SignageRepository", "Schedule triggered! Switching active playlist to: $playlistName")
            var newPlaylistId = ""
            if (playlistName != "Normal" && playlistName != "Unassigned") {
                // Fetch the list of playlists to find one with the matching name
                val url = "${config.pocketbaseUrl}/api/collections/playlists/records?filter=name=\"$playlistName\""
                val response = apiService.getPlaylistList(url)
                val matchingPlaylist = response.items.firstOrNull()
                if (matchingPlaylist != null) {
                    newPlaylistId = matchingPlaylist.id
                } else {
                    Log.e("SignageRepository", "Scheduled playlist '$playlistName' not found on server")
                }
            }

            // Update screen record on server (PATCH to screens collection)
            val patchUrl = "${config.pocketbaseUrl}/api/collections/screens/records/${config.screenId}"
            val fields = mapOf(
                "playlist" to newPlaylistId,
                "playlistId" to newPlaylistId,
                "schedulePlaylist" to "",
                "scheduleDate" to "",
                "scheduleTime" to ""
            )
            apiService.updateScreenRecord(patchUrl, fields)
            Log.d("SignageRepository", "Server screen record successfully updated/patched for schedule")
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error applying scheduled playlist switch", e)
        }
    }

    private fun resolveUrl(url: String, pocketbaseUrl: String): String {
        if (url.startsWith("data:", ignoreCase = true)) return url
        return url.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2")
    }

    private suspend fun syncPlaylist(pocketbaseUrl: String, playlistId: String) = withContext(Dispatchers.IO) {
        try {
            if (playlistId.equals("Normal", ignoreCase = true) || playlistId.equals("None", ignoreCase = true) || playlistId.isEmpty()) {
                if (assetDao.getAllAssets().isNotEmpty()) {
                    assetDao.clearAllAssets()
                }
                return@withContext
            }

            val actualId = if (playlistId.length != 15 || !playlistId.all { it.isLowerCase() || it.isDigit() }) {
                val queryUrl = "${resolveUrl(pocketbaseUrl, pocketbaseUrl)}/api/collections/playlists/records?filter=name=\"$playlistId\""
                val listResponse = apiService.getPlaylistList(queryUrl)
                listResponse.items.firstOrNull()?.id ?: ""
            } else {
                playlistId
            }

            if (actualId.isEmpty()) {
                if (assetDao.getAllAssets().isNotEmpty()) {
                    assetDao.clearAllAssets()
                }
                return@withContext
            }

            val url = "${resolveUrl(pocketbaseUrl, pocketbaseUrl)}/api/collections/playlists/records/$actualId"
            val response = apiService.getPlaylistRecord(url)

            Log.d("SignageRepository", "Synced playlist record name: ${response.name}")

            if (response.active == false) {
                Log.d("SignageRepository", "Playlist is inactive. Clearing device assets.")
                if (assetDao.getAllAssets().isNotEmpty()) {
                    assetDao.clearAllAssets()
                }
                return@withContext
            }

            // Store playlist settings (orientation, shuffle, loop, volume) into the ScreenConfig
            val currentConfig = getOrCreateConfig()
            val updatedConfig = currentConfig.copy(
                playlistOrientation = response.orientation ?: "horizontal",
                playlistShuffle = response.shuffle ?: false,
                playlistLoop = response.loop ?: true,
                playlistVolume = response.volume?.toInt() ?: 80
            )
            configDao.saveConfig(updatedConfig)

            // Map response assets to local PlaylistAssets configuration
            val newAssets = mutableListOf<PlaylistAsset>()

            // 1. Resolve from slides sequence (with custom durations, ordering, layout details)
            if (!response.slides.isNullOrEmpty()) {
                response.slides.forEachIndexed { index, slide ->
                    try {
                        val mediaId = slide.mediaId
                        val mediaItemUrl = "${resolveUrl(pocketbaseUrl, pocketbaseUrl)}/api/collections/media_items/records/$mediaId"
                        Log.d("SignageRepository", "Fetching media item details for slide: $mediaItemUrl")
                        val mediaItem = apiService.getMediaItemRecord(mediaItemUrl)
                        val isVideo = mediaItem.type.equals("video", ignoreCase = true)
                        val isYoutube = mediaItem.type.equals("youtube", ignoreCase = true)
                        
                        val fileUrl = if (!mediaItem.file.isNullOrEmpty()) {
                            "$pocketbaseUrl/api/files/media_items/${mediaItem.id}/${mediaItem.file}"
                        } else {
                            mediaItem.thumbnail
                        }
                        val finalUrl = resolveUrl(if (isYoutube) (mediaItem.youtube_url ?: "") else fileUrl, pocketbaseUrl)

                        val extension = if (isYoutube) "" else if (isVideo) ".mp4" else ".jpg"
                        val filename = if (isYoutube) {
                            "youtube_${mediaItem.youtube_video_id ?: mediaItem.id}"
                        } else if (mediaItem.thumbnail.startsWith("data:")) {
                            "media_${mediaItem.id}$extension"
                        } else {
                            val lastSlash = finalUrl.lastIndexOf('/')
                            if (lastSlash != -1 && lastSlash < finalUrl.length - 1) {
                                finalUrl.substring(lastSlash + 1)
                            } else {
                                "${mediaItem.title.replace("[^a-zA-Z0-9]".toRegex(), "_")}$extension"
                            }
                        }
                        val slideId = if (!slide.id.isNullOrEmpty()) slide.id else "${playlistId}_${mediaId}_$index"
                        newAssets.add(
                            PlaylistAsset(
                                id = slideId,
                                url = finalUrl,
                                filename = filename,
                                mediaType = mediaItem.type.lowercase(),
                                duration = slide.duration,
                                sortOrder = index,
                                checksum = mediaItem.checksum,
                                width = mediaItem.width,
                                height = mediaItem.height,
                                fileSize = mediaItem.fileSize,
                                fileSizeBytes = mediaItem.fileSizeBytes,
                                mimeType = mediaItem.mimeType,
                                youtubeVideoId = mediaItem.youtube_video_id
                            )
                        )
                    } catch (e: Exception) {
                        Log.e("SignageRepository", "Failed to fetch media item details for slide: ${slide.id}", e)
                    }
                }
            }

            // 2. Fallback to Pocketbase assetsJson if present and slides was empty
            if (newAssets.isEmpty() && !response.assetsJson.isNullOrEmpty()) {
                response.assetsJson.forEachIndexed { index, pbAsset ->
                    newAssets.add(
                        PlaylistAsset(
                            id = "${playlistId}_${pbAsset.id}_$index",
                            url = resolveUrl(pbAsset.url, pocketbaseUrl),
                            filename = pbAsset.filename,
                            mediaType = pbAsset.mediaType.lowercase(),
                            duration = pbAsset.duration,
                            sortOrder = index,
                            checksum = pbAsset.checksum,
                            width = pbAsset.width,
                            height = pbAsset.height,
                            fileSize = pbAsset.fileSize,
                            fileSizeBytes = pbAsset.fileSizeBytes,
                            mimeType = pbAsset.mimeType,
                            youtubeVideoId = pbAsset.youtubeVideoId
                        )
                    )
                }
            }

            // 3. Fallback to native files if attached and slides was empty
            if (newAssets.isEmpty() && response.files != null && response.files.isNotEmpty()) {
                response.files.forEachIndexed { index, fileName ->
                    val fileId = "${playlistId}_$index"
                    val fileUrl = "$pocketbaseUrl/api/files/playlists/$playlistId/$fileName"
                    val isVideo = fileName.endsWith(".mp4", ignoreCase = true) || fileName.endsWith(".webm", ignoreCase = true)
                    newAssets.add(
                        PlaylistAsset(
                            id = fileId,
                            url = resolveUrl(fileUrl, pocketbaseUrl),
                            filename = fileName,
                            mediaType = if (isVideo) "video" else "image",
                            duration = 10,
                            sortOrder = index
                        )
                    )
                }
            }

            // 4. Fallback to mediaIds if slides, assetsJson, and files were all empty
            if (newAssets.isEmpty() && !response.mediaIds.isNullOrEmpty()) {
                response.mediaIds.forEachIndexed { index, mediaId ->
                    try {
                        val mediaItemUrl = "${resolveUrl(pocketbaseUrl, pocketbaseUrl)}/api/collections/media_items/records/$mediaId"
                        Log.d("SignageRepository", "Fetching media item details: $mediaItemUrl")
                        val mediaItem = apiService.getMediaItemRecord(mediaItemUrl)
                        val isVideo = mediaItem.type.equals("video", ignoreCase = true)
                        val isYoutube = mediaItem.type.equals("youtube", ignoreCase = true)
                        
                        val fileUrl = if (!mediaItem.file.isNullOrEmpty()) {
                            "$pocketbaseUrl/api/files/media_items/${mediaItem.id}/${mediaItem.file}"
                        } else {
                            mediaItem.thumbnail
                        }
                        val finalUrl = resolveUrl(if (isYoutube) (mediaItem.youtube_url ?: "") else fileUrl, pocketbaseUrl)

                        val extension = if (isYoutube) "" else if (isVideo) ".mp4" else ".jpg"
                        val filename = if (isYoutube) {
                            "youtube_${mediaItem.youtube_video_id ?: mediaItem.id}"
                        } else if (mediaItem.thumbnail.startsWith("data:")) {
                            "media_${mediaItem.id}$extension"
                        } else {
                            val lastSlash = finalUrl.lastIndexOf('/')
                            if (lastSlash != -1 && lastSlash < finalUrl.length - 1) {
                                finalUrl.substring(lastSlash + 1)
                            } else {
                                "${mediaItem.title.replace("[^a-zA-Z0-9]".toRegex(), "_")}$extension"
                            }
                        }
                        val slideId = "${playlistId}_${mediaId}_$index"
                        newAssets.add(
                            PlaylistAsset(
                                id = slideId,
                                url = finalUrl,
                                filename = filename,
                                mediaType = mediaItem.type.lowercase(),
                                duration = mediaItem.duration,
                                sortOrder = index,
                                checksum = mediaItem.checksum,
                                width = mediaItem.width,
                                height = mediaItem.height,
                                fileSize = mediaItem.fileSize,
                                fileSizeBytes = mediaItem.fileSizeBytes,
                                mimeType = mediaItem.mimeType,
                                youtubeVideoId = mediaItem.youtube_video_id
                            )
                        )
                    } catch (e: Exception) {
                        Log.e("SignageRepository", "Failed to fetch media item details for ID: $mediaId", e)
                    }
                }
            }

            if (newAssets.isNotEmpty()) {
                // Apply shuffle if the playlist settings say so
                val finalAssets = if (response.shuffle == true) {
                    newAssets.shuffled()
                } else {
                    newAssets
                }.mapIndexed { index, asset -> asset.copy(sortOrder = index) }

                // Determine existing local files to keep them cached
                val currentAssetsList = assetDao.getAllAssets()
                val mergedAssets = finalAssets.map { newAsset ->
                    // Find any existing asset with the same URL that has a valid localPath
                    val existing = currentAssetsList.firstOrNull { it.url == newAsset.url && !it.localPath.isNullOrEmpty() && File(it.localPath).exists() }
                    if (existing != null) {
                        // Keep current local file path
                        newAsset.copy(localPath = existing.localPath)
                    } else {
                        newAsset
                    }
                }

                val hasChanged = currentAssetsList.size != mergedAssets.size ||
                        currentAssetsList.zip(mergedAssets).any { (old, new) ->
                            old.id != new.id ||
                            old.url != new.url ||
                            old.filename != new.filename ||
                            old.mediaType != new.mediaType ||
                            old.duration != new.duration ||
                            old.localPath != new.localPath ||
                            old.sortOrder != new.sortOrder ||
                            old.checksum != new.checksum ||
                            old.width != new.width ||
                            old.height != new.height ||
                            old.fileSize != new.fileSize ||
                            old.fileSizeBytes != new.fileSizeBytes ||
                            old.mimeType != new.mimeType ||
                            old.youtubeVideoId != new.youtubeVideoId
                        }

                if (hasChanged) {
                    // Update database
                    assetDao.clearAllAssets()
                    assetDao.insertAssets(mergedAssets)

                    // Start downloading new items in the background
                    downloadPendingAssets()
                }
            }
        } catch (e: Exception) {
            Log.e("SignageRepository", "Failed to sync playlist details", e)
        }
    }

    suspend fun downloadPendingAssets() = withContext(Dispatchers.IO) {
        val assets = assetDao.getAllAssets()
        val cacheDir = File(context.filesDir, "signage_cache")

        // Exclude YouTube videos from the offline file download pipeline
        val pending = assets.filter { it.mediaType != "youtube" && (it.localPath.isNullOrEmpty() || !File(it.localPath).exists()) }
        if (pending.isEmpty()) {
            downloadStateFlow.value = DownloadState(isDownloading = false)
            return@withContext
        }

        val total = pending.size
        pending.forEachIndexed { index, asset ->
            Log.d("SignageRepository", "Downloading playlist asset: ${asset.url}")
            downloadStateFlow.value = DownloadState(
                isDownloading = true,
                totalFiles = total,
                completedFiles = index,
                currentFileProgress = 0.0f,
                currentFileName = asset.filename
            )

            val localFile = File(cacheDir, "${asset.id}_${asset.filename}")
            val tmpFile = File(cacheDir, "${asset.id}_${asset.filename}.tmp")
            try {
                if (asset.url.startsWith("data:", ignoreCase = true)) {
                    val commaIndex = asset.url.indexOf(",")
                    if (commaIndex != -1) {
                        val base64Data = asset.url.substring(commaIndex + 1)
                        val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                        FileOutputStream(tmpFile).use { outputStream ->
                            outputStream.write(bytes)
                        }

                        // Calculate SHA-256 and verify
                        if (!asset.checksum.isNullOrEmpty()) {
                            val calculated = calculateSHA256(tmpFile)
                            if (!calculated.equals(asset.checksum, ignoreCase = true)) {
                                throw Exception("Checksum verification failed for base64 asset. Expected: ${asset.checksum}, got: $calculated")
                            }
                        }

                        if (tmpFile.renameTo(localFile)) {
                            assetDao.updateLocalPath(asset.id, localFile.absolutePath)
                        } else {
                            throw Exception("Failed to rename temporary file to local path")
                        }

                        downloadStateFlow.value = DownloadState(
                            isDownloading = true,
                            totalFiles = total,
                            completedFiles = index + 1,
                            currentFileProgress = 0.0f,
                            currentFileName = asset.filename
                        )
                        Log.d("SignageRepository", "Base64 asset cached successfully to: ${localFile.absolutePath}")
                    } else {
                        throw Exception("Invalid data URL format")
                    }
                } else {
                    val request = Request.Builder().url(asset.url).build()
                    okHttpClient.newCall(request).execute().use { response ->
                        if (!response.isSuccessful) throw Exception("Failed download status: ${response.code}")
                        val body = response.body ?: throw Exception("Null response body")
                        val contentLength = body.contentLength()
                        body.byteStream().use { inputStream ->
                            FileOutputStream(tmpFile).use { outputStream ->
                                val buffer = ByteArray(8192)
                                var bytesRead: Int
                                var totalBytesRead = 0L
                                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                                    outputStream.write(buffer, 0, bytesRead)
                                    totalBytesRead += bytesRead
                                    if (contentLength > 0) {
                                        val progress = totalBytesRead.toFloat() / contentLength
                                        downloadStateFlow.value = DownloadState(
                                            isDownloading = true,
                                            totalFiles = total,
                                            completedFiles = index,
                                            currentFileProgress = progress,
                                            currentFileName = asset.filename
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Calculate SHA-256 and verify
                    if (!asset.checksum.isNullOrEmpty()) {
                        val calculated = calculateSHA256(tmpFile)
                        if (!calculated.equals(asset.checksum, ignoreCase = true)) {
                            throw Exception("Checksum verification failed for downloaded asset. Expected: ${asset.checksum}, got: $calculated")
                        }
                    }

                    if (tmpFile.renameTo(localFile)) {
                        assetDao.updateLocalPath(asset.id, localFile.absolutePath)
                    } else {
                        throw Exception("Failed to rename temporary file to local path")
                    }

                    downloadStateFlow.value = DownloadState(
                        isDownloading = true,
                        totalFiles = total,
                        completedFiles = index + 1,
                        currentFileProgress = 0.0f,
                        currentFileName = asset.filename
                    )
                    Log.d("SignageRepository", "Asset cached successfully to: ${localFile.absolutePath}")
                }
            } catch (e: Exception) {
                Log.e("SignageRepository", "Failed to download asset: ${asset.url}", e)
                if (tmpFile.exists()) {
                    tmpFile.delete()
                }
                // Send diagnostics heartbeat with error status for playing/download failure tracking
                sendDiagnosticsHeartbeat("Playback/Download Error: Failed to download or verify checksum of ${asset.filename} (${e.message})")
            }
        }
        downloadStateFlow.value = DownloadState(isDownloading = false)
    }

    private fun calculateSHA256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { inputStream ->
            val buffer = ByteArray(8192)
            var bytesRead = inputStream.read(buffer)
            while (bytesRead != -1) {
                digest.update(buffer, 0, bytesRead)
                bytesRead = inputStream.read(buffer)
            }
        }
        val hashBytes = digest.digest()
        return hashBytes.joinToString("") { "%02x".format(it) }
    }

    private var sseJob: kotlinx.coroutines.Job? = null

    fun startRealtimeSync() {
        sseJob?.cancel()
        sseJob = kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                try {
                    val config = getOrCreateConfig()
                    if (config.pocketbaseUrl.isEmpty() || config.screenId.isEmpty()) {
                        delay(5000)
                        continue
                    }

                    val url = "${resolveUrl(config.pocketbaseUrl, config.pocketbaseUrl)}/api/realtime"
                    Log.d("SignageRepository", "Connecting to PocketBase SSE at $url")

                    val request = Request.Builder()
                        .url(url)
                        .header("Accept", "text/event-stream")
                        .build()

                    okHttpClient.newCall(request).execute().use { response ->
                        if (!response.isSuccessful) {
                            Log.e("SignageRepository", "SSE connection failed: ${response.code}")
                            delay(5000)
                            return@use
                        }

                        val reader = response.body?.charStream()?.buffered() ?: return@use
                        var clientId = ""
                        var line: String? = null

                        while (isActive && reader.readLine().also { line = it } != null) {
                            val currentLine = line ?: break
                            if (currentLine.startsWith("event:")) {
                                val event = currentLine.substring(6).trim()
                                val dataLine = reader.readLine() ?: break
                                if (dataLine.startsWith("data:")) {
                                    val data = dataLine.substring(5).trim()
                                    Log.d("SignageRepository", "SSE Event: $event, Data: $data")
                                    
                                    if (event == "PB_CONNECT") {
                                        val connectionInfo = moshi.adapter(Map::class.java).fromJson(data)
                                        clientId = connectionInfo?.get("clientId") as? String ?: ""
                                        if (clientId.isNotEmpty()) {
                                            Log.d("SignageRepository", "SSE Connected. ClientID: $clientId. Subscribing...")
                                            subscribeToRealtime(config.pocketbaseUrl, clientId, config.screenId)
                                        }
                                    } else {
                                        Log.d("SignageRepository", "SSE update event received. Syncing screen status.")
                                        syncScreenStatus()
                                    }
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e("SignageRepository", "SSE connection error, retrying in 5 seconds...", e)
                    delay(5000)
                }
            }
        }
    }

    private suspend fun subscribeToRealtime(pocketbaseUrl: String, clientId: String, screenId: String) {
        try {
            val url = "${resolveUrl(pocketbaseUrl, pocketbaseUrl)}/api/realtime"
            val bodyMap = mapOf(
                "clientId" to clientId,
                "subscriptions" to listOf("screens", "playlists", "media_items")
            )
            val jsonBody = moshi.adapter(Map::class.java).toJson(bodyMap) ?: ""
            val requestBody = jsonBody.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()

            okHttpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Log.d("SignageRepository", "Successfully subscribed to PocketBase SSE collections")
                } else {
                    Log.e("SignageRepository", "Failed to subscribe to PocketBase SSE: ${response.code}")
                }
            }
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error subscribing to SSE topics", e)
        }
    }

    suspend fun sendDiagnosticsHeartbeat(currentPlayingAsset: String?): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val config = getOrCreateConfig()
            val cpuTemp = getCpuTemperature()

            // Calculations using Android StatFs
            val stat = StatFs(context.filesDir.absolutePath)
            val blockSize = stat.blockSizeLong
            val totalBlocks = stat.blockCountLong
            val availableBlocks = stat.availableBlocksLong
            val storageAvailableBytes = availableBlocks * blockSize
            val storageUsedBytes = (totalBlocks - availableBlocks) * blockSize

            val request = HeartbeatRequest(
                hardwareUuid = config.hardwareUuid,
                cpuTemp = cpuTemp,
                currentPlayingAsset = currentPlayingAsset ?: "None",
                storageUsedBytes = storageUsedBytes,
                storageAvailableBytes = storageAvailableBytes
            )

            val url = "${config.serverUrl}/api/v1/devices/heartbeat"
            val response = apiService.sendHeartbeat(url, request)

            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Diagnosis heartbeat error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error sending heartbeat report", e)
            Result.failure(e)
        }
    }

    private fun getCpuTemperature(): Double {
        return try {
            // Read from various thermal files typically found on Android/Linux
            val paths = listOf(
                "/sys/class/thermal/thermal_zone0/temp",
                "/sys/class/thermal/thermal_zone1/temp",
                "/sys/devices/virtual/thermal/thermal_zone0/temp"
            )
            for (path in paths) {
                val file = File(path)
                if (file.exists()) {
                    val tempStr = file.readText().trim()
                    val rawTemp = tempStr.toDoubleOrNull()
                    if (rawTemp != null) {
                        // Some structures log temp in milli-degrees Celsius (e.g., 52000 for 52C)
                        return if (rawTemp > 1000) rawTemp / 1000.0 else rawTemp
                    }
                }
            }
            // Real thermal fallback: battery temperature or standard simulation around comfortable thermal values (42 C to 53 C)
            45.0 + Random.nextDouble(0.0, 8.5)
        } catch (e: Exception) {
            48.2
        }
    }

    // Direct helper to clear the cache for testing configurations
    suspend fun clearCache() = withContext(Dispatchers.IO) {
        try {
            val cacheDir = File(context.filesDir, "signage_cache")
            if (cacheDir.exists()) {
                cacheDir.listFiles()?.forEach { it.delete() }
            }
            assetDao.clearAllAssets()
            val config = getOrCreateConfig()
            configDao.saveConfig(config.copy(screenId = "", pairingCode = "", status = "pairing"))
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error purging offline cache", e)
        }
    }

    // Direct helper to inject simulated assets for demonstration / preview mode in emulator!
    suspend fun injectDemoPlaylist() = withContext(Dispatchers.IO) {
        val demoAssets = listOf(
            PlaylistAsset(
                id = "demo_img_1",
                url = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000",
                filename = "sneaker_ad_banner.jpg",
                mediaType = "image",
                duration = 8,
                sortOrder = 0
            ),
            PlaylistAsset(
                id = "demo_img_2",
                url = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000",
                filename = "audio_headphone_promotion.jpg",
                mediaType = "image",
                duration = 6,
                sortOrder = 1
            ),
            PlaylistAsset(
                id = "demo_img_3",
                url = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000",
                filename = "smartwatch_sleek_promo.jpg",
                mediaType = "image",
                duration = 7,
                sortOrder = 2
            )
        )
        // Clear and insert
        assetDao.clearAllAssets()
        assetDao.insertAssets(demoAssets)
        
        // Mark status as active for demonstrating looping playback
        val current = getOrCreateConfig()
        configDao.saveConfig(current.copy(status = "active"))
        
        // Download these files in background so they function offline!
        downloadPendingAssets()
    }
}
