package com.example.data.repository

import android.content.Context
import android.os.StatFs
import android.util.Log
import com.example.data.database.AppDatabase
import com.example.data.database.PlaylistAsset
import com.example.data.database.ScreenConfig
import com.example.data.network.ErrorLoggingInterceptor
import com.example.data.network.redactText
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
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.security.MessageDigest
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.flow.MutableStateFlow
import android.os.SystemClock

data class DownloadState(
    val isDownloading: Boolean = false,
    val totalFiles: Int = 0,
    val completedFiles: Int = 0,
    val currentFileProgress: Float = 0.0f,
    val currentFileName: String = "",
    val downloadedBytes: Long = 0L,
    val totalFileBytes: Long = 0L,
    val errorMessage: String? = null,
    /** Smoothed download speed of the current run, bytes per second (0 = unknown). */
    val bytesPerSecond: Long = 0L,
    /** elapsedRealtime() at which the next automatic retry starts (0 = none scheduled). */
    val nextRetryAt: Long = 0L,
    /** Last failure was a connectivity problem (vs. a server / file problem). */
    val offline: Boolean = false
)

/** Turns a download exception into something a person standing at the TV can act on. */
internal fun friendlyDownloadError(e: Throwable): Pair<String, Boolean> = when (e) {
    is java.net.UnknownHostException, is java.net.ConnectException, is java.net.NoRouteToHostException ->
        "This display can't reach the internet. Check its network connection." to true
    is java.net.SocketTimeoutException, is java.io.InterruptedIOException ->
        "The connection is very slow or keeps dropping." to true
    is javax.net.ssl.SSLException ->
        "A secure connection to the server couldn't be made. Check the display's date and time." to true
    else -> {
        val msg = e.message ?: ""
        when {
            msg.contains("Checksum", ignoreCase = true) -> "A file arrived damaged and will be downloaded again." to false
            msg.contains("status: 404") -> "A file is no longer on the server — it may have been deleted." to false
            msg.contains("status: 403") -> "The server refused a file download." to false
            msg.contains("status: 5") -> "The server had a problem sending a file. It will retry shortly." to false
            msg.contains("ENOSPC", ignoreCase = true) || msg.contains("No space", ignoreCase = true) ->
                "This display is out of storage space." to false
            else -> "Some files couldn't be downloaded." to false
        }
    }
}

class SignageRepository(private val context: Context) {

    private val database = AppDatabase.getDatabase(context)
    private val configDao = database.screenConfigDao()
    private val assetDao = database.playlistAssetDao()

    private val moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .connectionPool(okhttp3.ConnectionPool(8, 5, java.util.concurrent.TimeUnit.MINUTES))
        .protocols(listOf(okhttp3.Protocol.HTTP_2, okhttp3.Protocol.HTTP_1_1))
        .addInterceptor(ErrorLoggingInterceptor(context))
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.HEADERS // Level.HEADERS avoids buffering full binary bodies into RAM
        })
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(com.example.AppConfig.SERVER_URL + "/") // Hardcoded base URL
        .client(okHttpClient)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()

    private val apiService = retrofit.create(SignageApiService::class.java)

    val configFlow: Flow<ScreenConfig?> = configDao.getConfigFlow()
    val assetsFlow: Flow<List<PlaylistAsset>> = assetDao.getAllAssetsFlow()
    val downloadStateFlow = kotlinx.coroutines.flow.MutableStateFlow(DownloadState())
    val commandFlow = kotlinx.coroutines.flow.MutableSharedFlow<String>(extraBufferCapacity = 64)

    // elapsedRealtime() at which the most recently *finished* download run
    // started. The ViewModel compares this with when the playlist last
    // changed to know whether a download pass over the new playlist has
    // completed (successfully or not) — until then it keeps showing the old
    // content instead of switching to a half-downloaded new playlist.
    val downloadRunCompletedFlow = MutableStateFlow(0L)

    // Kept in SharedPreferences rather than the Room ScreenConfig table on
    // purpose: the database uses fallbackToDestructiveMigration, so adding a
    // column there would wipe the table (and the device's identity) on the
    // next app update.
    private val prefs = context.getSharedPreferences("signage_device", Context.MODE_PRIVATE)

    /** Playback paused from the dashboard; the player shows a paused screen until resumed. */
    val pausedFlow = MutableStateFlow(prefs.getBoolean("paused", false))

    private fun setPaused(paused: Boolean) {
        if (pausedFlow.value != paused) {
            pausedFlow.value = paused
            prefs.edit().putBoolean("paused", paused).apply()
        }
    }

    // Bumped by clearDeviceAssets() so a download run in progress notices its
    // files were wiped out from under it and restarts instead of finishing
    // with renames that fail.
    @Volatile private var cacheGeneration = 0

    // syncScreenStatus() is triggered from several places at once (poll loop,
    // socket push, SSE events). Running it concurrently let two passes both
    // act on the same force_sync/clear_cache flag before either cleared it —
    // e.g. wiping the cache a second time mid-download. Only one pass runs at
    // a time; a request arriving during a pass schedules one more pass after it.
    private val syncMutex = Mutex()
    @Volatile private var resyncRequested = false

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
            // Reuse the device id from SharedPreferences if there is one. The
            // Room database is destructively migrated on schema changes, which
            // used to generate a brand-new id after such an app update — the
            // server then saw a different TV, and the screen dropped back to
            // pairing.
            val savedUuid = prefs.getString("hardware_uuid", null)
            val uuid = savedUuid ?: UUID.randomUUID().toString()
            config = ScreenConfig(hardwareUuid = uuid)
            configDao.saveConfig(config)
            prefs.edit().putString("hardware_uuid", uuid).apply()
        } else {
            if (prefs.getString("hardware_uuid", null) != config.hardwareUuid) {
                prefs.edit().putString("hardware_uuid", config.hardwareUuid).apply()
            }
            // Force override stored URLs to use AppConfig hardcoded constants
            if (config.serverUrl != com.example.AppConfig.SERVER_URL || config.pocketbaseUrl != com.example.AppConfig.POCKETBASE_URL) {
                config = config.copy(
                    serverUrl = com.example.AppConfig.SERVER_URL,
                    pocketbaseUrl = com.example.AppConfig.POCKETBASE_URL
                )
                configDao.saveConfig(config)
            }
        }
        config
    }

    suspend fun updateServerUrls(serverUrl: String, pocketbaseUrl: String) = withContext(Dispatchers.IO) {
        val current = getOrCreateConfig()
        val updated = current.copy(serverUrl = serverUrl, pocketbaseUrl = pocketbaseUrl)
        configDao.saveConfig(updated)
    }

    suspend fun requestPairingCode(forceRefresh: Boolean = false): Result<ScreenConfig> = withContext(Dispatchers.IO) {
        try {
            val initialConfig = getOrCreateConfig()
            val request = PairingRequest(hardwareUuid = initialConfig.hardwareUuid, forceRefresh = forceRefresh)
            val url = "${initialConfig.serverUrl}/api/v1/devices/pairing-code"

            Log.d("SignageRepository", "Requesting pairing code from: $url")
            val response = apiService.getPairingCode(url, request)

            val basePbUrl = response.pocketbaseUrl
            val currentConfig = getOrCreateConfig()
            val targetHost = getReplacementHost(initialConfig.serverUrl)
            val resolvedPocketbaseUrl = if (!basePbUrl.isNullOrEmpty()) {
                basePbUrl.replace("localhost", targetHost).replace("127.0.0.1", targetHost)
            } else {
                currentConfig.pocketbaseUrl
            }

            val updatedConfig = currentConfig.copy(
                screenId = response.screenId,
                pairingCode = response.pairingCode,
                status = response.status,
                pocketbaseUrl = resolvedPocketbaseUrl
            )
            configDao.saveConfig(updatedConfig)
            Result.success(updatedConfig)
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error requesting pairing code", e)
            logErrorToServer("Pairing Request Failure", e.message ?: "Unknown pairing error")
            Result.failure(e)
        }
    }

    suspend fun syncScreenStatus(): Result<Unit> {
        if (!syncMutex.tryLock()) {
            resyncRequested = true
            return Result.success(Unit)
        }
        try {
            var result: Result<Unit>
            do {
                resyncRequested = false
                result = syncScreenStatusOnce()
            } while (resyncRequested)
            return result
        } finally {
            syncMutex.unlock()
        }
    }

    // Clears a one-shot command flag (clear_cache / force_sync /
    // restart_playlist) on the server BEFORE acting on it. If the clear
    // fails, the command is skipped this time rather than executed on every
    // sync forever (a stuck force_sync used to wipe and re-download the
    // whole cache every minute).
    private suspend fun clearCommandFlag(config: ScreenConfig, flag: String): Boolean {
        return try {
            acknowledge(config, mapOf("clear" to listOf(flag)))
            true
        } catch (e: Exception) {
            Log.e("SignageRepository", "Failed to clear $flag flag on server; skipping command this time", e)
            logErrorToServer("Command Flag Clear Failure", "$flag: ${e.message ?: "Unknown error"}")
            false
        }
    }

    /**
     * Reports handled commands / local changes to the server (POST /devices/ack,
     * verified by this device's hardware id). Falls back to the old direct
     * PocketBase write only if the server is too old to have the endpoint.
     */
    private suspend fun acknowledge(config: ScreenConfig, fields: Map<String, Any?>) {
        val body = fields + mapOf("screenId" to config.screenId, "hardwareUuid" to config.hardwareUuid)
        val response = apiService.acknowledge("${config.serverUrl}/api/v1/devices/ack", body)
        if (response.isSuccessful) return
        if (response.code() == 404 && response.errorBody()?.string()?.contains("unpaired") != true) {
            val legacy = mutableMapOf<String, Any?>("hardwareUuid" to config.hardwareUuid)
            (fields["clear"] as? List<*>)?.forEach { legacy[it.toString()] = false }
            fields["volume"]?.let { legacy["volume"] = it }
            apiService.updateScreenRecord("${config.pocketbaseUrl}/api/collections/screens/records/${config.screenId}", legacy)
            return
        }
        throw IllegalStateException("Acknowledge failed: HTTP ${response.code()}")
    }

    private suspend fun syncScreenStatusOnce(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val initialConfig = getOrCreateConfig()
            if (initialConfig.screenId.isEmpty()) {
                return@withContext Result.failure(IllegalStateException("No screen record paired yet"))
            }

            // Read screen status through the server's cached device-sync endpoint
            // rather than hitting PocketBase's REST API directly — at fleet scale,
            // every device polling PocketBase straight was the single biggest
            // source of load. Same record shape either way.
            val url = "${initialConfig.serverUrl}/api/v1/devices/sync"
            val response = apiService.getScreenStatus(
                url,
                mapOf("screenId" to initialConfig.screenId, "hardwareUuid" to initialConfig.hardwareUuid)
            )

            Log.d("SignageRepository", "Synced screen status: ${response.status}")
            val currentConfig = getOrCreateConfig()
            val isWhiteLabelNow = response.whiteLabel ?: false
            val logoUrlNow = response.websiteLogo ?: ""
            val nameNow = response.websiteName ?: ""

            val isLogoChanged = logoUrlNow.isNotEmpty() && currentConfig.whiteLabelLogoUrl != logoUrlNow
            val wasWhiteLabelLogoMissing = isWhiteLabelNow && (
                    currentConfig.whiteLabelLogoPath.isNullOrEmpty() ||
                    isLogoChanged ||
                    !File(currentConfig.whiteLabelLogoPath).exists()
            )

            // If screen status on backend is pairing (or the owner unlinked this TV)
            if (response.status == "pairing" || response.status == "unlinked") {
                if (currentConfig.status != "pairing") {
                    Log.d("SignageRepository", "Screen status reset to pairing on backend. Unpairing device.")
                    val unassignedConfig = currentConfig.copy(
                        screenId = "",
                        pairingCode = "",
                        status = "pairing"
                    )
                    configDao.saveConfig(unassignedConfig)
                    clearDeviceAssets()
                    setPaused(false)
                    return@withContext Result.success(Unit)
                } else {
                    // Device is currently in pairing mode waiting for user to pair.
                    // Only request a new code if expired or empty.
                    var codeExpired = false
                    if (!response.pairing_code_expires.isNullOrEmpty()) {
                        try {
                            val expiresMs = java.time.Instant.parse(response.pairing_code_expires).toEpochMilli()
                            if (System.currentTimeMillis() >= expiresMs) {
                                codeExpired = true
                            }
                        } catch (_: Exception) {}
                    }

                    if (codeExpired || response.pairing_code.isNullOrEmpty()) {
                        Log.d("SignageRepository", "Pairing code expired or empty on backend. Requesting new code...")
                        requestPairingCode(forceRefresh = true)
                    } else if (response.pairing_code != currentConfig.pairingCode) {
                        val updatedConfig = currentConfig.copy(
                            pairingCode = response.pairing_code,
                            status = "pairing"
                        )
                        configDao.saveConfig(updatedConfig)
                    }
                    return@withContext Result.success(Unit)
                }
            }

            val updatedConfig = currentConfig.copy(
                status = response.status,
                screenName = response.name ?: currentConfig.screenName,
                screenVolume = response.volume ?: currentConfig.screenVolume,
                isWhiteLabel = isWhiteLabelNow,
                whiteLabelLogoUrl = if (logoUrlNow.isNotEmpty()) logoUrlNow else currentConfig.whiteLabelLogoUrl,
                whiteLabelName = if (nameNow.isNotEmpty()) nameNow else currentConfig.whiteLabelName,
                whiteLabelLogoPath = if (isLogoChanged) null else currentConfig.whiteLabelLogoPath,
                cameraMountEnabled = response.cameraMountEnabled ?: false,
                lastSyncedAt = System.currentTimeMillis()
            )
            configDao.saveConfig(updatedConfig)
            setPaused(response.paused == true)

            // Trigger asset download if whitelabel logo is missing or changed
            if (isWhiteLabelNow && wasWhiteLabelLogoMissing && logoUrlNow.isNotEmpty()) {
                startDownloadingPendingAssets()
            }

            // clear_cache: an explicit "wipe everything" — the screen goes blank
            // and re-downloads from scratch.
            if (response.clear_cache == true && clearCommandFlag(currentConfig, "clear_cache")) {
                Log.d("SignageRepository", "Clear cache command received. Clearing device assets.")
                clearDeviceAssets()
            }

            // force_sync (the dashboard's "Sync" button): re-fetch the playlist
            // and re-download every file, but keep playing the current files
            // while that happens. It used to wipe the cache first, which left
            // the screen on "Downloading media" for the whole re-download (and
            // forever if any one file then failed).
            var forceRedownload = false
            if (response.force_sync == true && clearCommandFlag(currentConfig, "force_sync")) {
                Log.d("SignageRepository", "Force sync command received. Re-downloading all assets in the background.")
                forceRedownload = true
                commandFlow.emit("restart_playlist")
            }

            if (response.restart_playlist == true && clearCommandFlag(currentConfig, "restart_playlist")) {
                Log.d("SignageRepository", "Restart playlist command received. Restarting loop playlist from start.")
                commandFlow.emit("restart_playlist")
            }

            var activePlaylistId = response.playlistId ?: response.playlist
            if (activePlaylistId == "None") activePlaylistId = ""

            // Check if schedule is due
            if (!response.schedulePlaylist.isNullOrEmpty() && !response.scheduleDate.isNullOrEmpty() && !response.scheduleTime.isNullOrEmpty()) {
                if (isScheduleDue(response.scheduleDate, response.scheduleTime)) {
                    val newPlaylistId = applyScheduledPlaylist(currentConfig, response.schedulePlaylist)
                    if (newPlaylistId.isNotEmpty()) {
                        activePlaylistId = newPlaylistId
                    }
                }
            }

            // If active or online, sync the actual playlist assets
            if (response.status == "active" || response.status == "online") {
                if (!activePlaylistId.isNullOrEmpty()) {
                    syncPlaylist(currentConfig.pocketbaseUrl, activePlaylistId)
                    if (forceRedownload) {
                        startDownloadingPendingAssets(forceAll = true)
                    }
                } else {
                    // Clear playlist assets since none assigned
                    if (assetDao.getAllAssets().isNotEmpty()) {
                        assetDao.clearAllAssets()
                    }
                    // Clear widget settings from local DB
                    val latestConfig = getOrCreateConfig()
                    val clearedConfig = latestConfig.copy(
                        widgetType = null,
                        widgetPlacement = null,
                        widgetLink = null
                    )
                    configDao.saveConfig(clearedConfig)
                }
            }

            Result.success(Unit)
        } catch (e: retrofit2.HttpException) {
            // Only unpair when the server explicitly says this device no longer
            // owns a screen (`"unpaired":true` in the body). A bare 404/403 can
            // come from a reverse proxy mid-deploy or a backend hiccup, and
            // treating that as "deleted" used to wipe and unpair every TV at once.
            val errorBody = try { e.response()?.errorBody()?.string() } catch (_: Exception) { null }
            val serverSaysUnpaired = (e.code() == 404 || e.code() == 403) &&
                errorBody?.replace(" ", "")?.contains("\"unpaired\":true") == true
            if (serverSaysUnpaired) {
                Log.d("SignageRepository", "Server reports this screen was deleted/reassigned. Unpairing device and purging cache.")
                val currentConfig = getOrCreateConfig()
                val unassignedConfig = currentConfig.copy(
                    screenId = "",
                    pairingCode = "",
                    status = "pairing"
                )
                configDao.saveConfig(unassignedConfig)
                clearDeviceAssets()
                setPaused(false)
            }
            Log.e("SignageRepository", "HTTP error syncing screen status with backend", e)
            logErrorToServer("Sync Status HTTP Error", "HTTP ${e.code()}: ${e.message()}")
            Result.failure(e)
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error syncing screen status with backend", e)
            logErrorToServer("Sync Status Failure", e.message ?: "Unknown error")

            // Device is offline — keep playing cached content indefinitely.
            // The device will auto-resume syncing once connectivity is restored.
            // Only intentional unpairing paths are: server-side 404 (screen deleted)
            // or admin disconnect via dashboard.

            Result.failure(e)
        }
    }

    // Direct helper to clear the local cached files and playlist database assets without unpairing
    suspend fun clearDeviceAssets() = withContext(Dispatchers.IO) {
        cacheGeneration++
        try {
            val cacheDir = File(context.filesDir, "signage_cache")
            if (cacheDir.exists()) {
                cacheDir.listFiles()?.forEach { it.delete() }
            }
            try {
                context.cacheDir?.deleteRecursively()
            } catch (ex: Exception) {
                Log.e("SignageRepository", "Error clearing cache directory", ex)
            }
            assetDao.clearAllAssets()
            Log.d("SignageRepository", "Successfully cleared device assets and cache directory files")
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error purging local assets", e)
            logErrorToServer("Clear Assets Failure", e.message ?: "Unknown error")
        }
    }

    suspend fun cleanupOrphanCacheFiles() = withContext(Dispatchers.IO) {
        try {
            val config = getOrCreateConfig()
            val activeAssets = assetDao.getAllAssets()
            val keepFiles = mutableSetOf<String>()

            // Keep whitelabel logo file if present
            if (!config.whiteLabelLogoPath.isNullOrEmpty()) {
                val logoFile = File(config.whiteLabelLogoPath)
                keepFiles.add(logoFile.name)
            }

            // Keep all active asset files
            activeAssets.forEach { asset ->
                if (!asset.localPath.isNullOrEmpty()) {
                    keepFiles.add(File(asset.localPath).name)
                }
                val defaultCacheName = getCacheFileName(asset.url, asset.filename)
                keepFiles.add(defaultCacheName)
            }

            val cacheDir = File(context.filesDir, "signage_cache")
            if (cacheDir.exists()) {
                cacheDir.listFiles()?.forEach { file ->
                    if (file.isFile && !file.name.endsWith(".tmp") && !keepFiles.contains(file.name)) {
                        Log.d("SignageRepository", "Deleting orphaned cache asset from previous playlist: ${file.name}")
                        file.delete()
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error running orphan cache cleanup", e)
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

    private suspend fun applyScheduledPlaylist(config: ScreenConfig, playlistName: String): String = withContext(Dispatchers.IO) {
        var newPlaylistId = ""
        try {
            Log.d("SignageRepository", "Schedule triggered! Switching active playlist to: $playlistName")
            if (Regex("^[a-z0-9]{15}$").matches(playlistName)) {
                // Current dashboards store the playlist's id. The server decides
                // the final playlist when we acknowledge below; this only lets
                // the switch show at once instead of on the next sync.
                newPlaylistId = playlistName
            } else if (playlistName != "Normal" && playlistName != "Unassigned") {
                // Older schedules stored the playlist name.
                val url = "${config.pocketbaseUrl}/api/collections/playlists/records?filter=name=\"$playlistName\""
                val response = apiService.getPlaylistList(url)
                val matchingPlaylist = response.items.firstOrNull()
                if (matchingPlaylist != null) {
                    newPlaylistId = matchingPlaylist.id
                } else {
                    Log.e("SignageRepository", "Scheduled playlist '$playlistName' not found on server")
                }
            }

            // Tell the server the scheduled switch happened (it clears the schedule).
            acknowledge(config, mapOf("schedule" to mapOf("playlistId" to newPlaylistId)))
            Log.d("SignageRepository", "Server screen record successfully updated/patched for schedule")
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error applying scheduled playlist switch", e)
        }
        newPlaylistId
    }

    private fun resolveUrl(url: String, pocketbaseUrl: String, serverUrl: String): String {
        if (url.startsWith("data:", ignoreCase = true)) return url
        val targetHost = getReplacementHost(serverUrl)
        return url.replace("localhost", targetHost).replace("127.0.0.1", targetHost)
    }

    private fun getCacheFileName(url: String, filename: String): String {
        return try {
            val ext = filename.substringAfterLast('.', "")
            val extSuffix = if (ext.isNotEmpty()) ".$ext" else ""
            val md = MessageDigest.getInstance("MD5")
            val digest = md.digest(url.toByteArray())
            val hash = digest.joinToString("") { "%02x".format(it) }
            val cleanName = filename.substringBeforeLast('.').replace("[^a-zA-Z0-9_-]".toRegex(), "_")
            "${hash}_$cleanName$extSuffix"
        } catch (e: Exception) {
            "${url.hashCode()}_$filename"
        }
    }

    suspend fun downloadWhiteLabelLogo(
        logoDataOrUrl: String,
        totalFilesForProgress: Int = 0,
        completedFilesForProgress: Int = 0
    ): String? = withContext(Dispatchers.IO) {
        if (logoDataOrUrl.isEmpty()) return@withContext null
        val config = getOrCreateConfig()
        val cacheDir = File(context.filesDir, "signage_cache")
        if (!cacheDir.exists()) {
            cacheDir.mkdirs()
        }
        
        val logoFileName = getCacheFileName(logoDataOrUrl, "whitelabel_logo.png")
        val logoFile = File(cacheDir, logoFileName)
        val tmpFile = File(logoFile.absolutePath + ".tmp")
        
        try {
            if (logoDataOrUrl.startsWith("data:", ignoreCase = true)) {
                val commaIndex = logoDataOrUrl.indexOf(",")
                if (commaIndex != -1) {
                    val base64Data = logoDataOrUrl.substring(commaIndex + 1)
                    val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                    FileOutputStream(tmpFile).use { outputStream ->
                        outputStream.write(bytes)
                    }
                    if (logoFile.exists()) {
                        logoFile.delete()
                    }
                    if (tmpFile.renameTo(logoFile)) {
                        return@withContext logoFile.absolutePath
                    }
                }
            } else {
                val resolvedUrl = resolveUrl(logoDataOrUrl, config.pocketbaseUrl, config.serverUrl)
                val request = Request.Builder().url(resolvedUrl).build()
                okHttpClient.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val body = response.body
                        if (body != null) {
                            val contentLength = body.contentLength()
                            body.byteStream().use { inputStream ->
                                FileOutputStream(tmpFile).use { outputStream ->
                                    val buffer = ByteArray(8192)
                                    var bytesRead: Int
                                    var totalBytesRead = 0L
                                    var lastProgressUpdatePercent = -1
                                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                                        outputStream.write(buffer, 0, bytesRead)
                                        totalBytesRead += bytesRead
                                        if (totalFilesForProgress > 0 && contentLength > 0) {
                                            val progress = totalBytesRead.toFloat() / contentLength
                                            val percent = (progress * 100).toInt()
                                            if (percent > lastProgressUpdatePercent) {
                                                lastProgressUpdatePercent = percent
                                                downloadStateFlow.value = DownloadState(
                                                    isDownloading = true,
                                                    totalFiles = totalFilesForProgress,
                                                    completedFiles = completedFilesForProgress,
                                                    currentFileProgress = progress.coerceIn(0f, 1f),
                                                    currentFileName = "Brand Logo"
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                            if (logoFile.exists()) {
                                logoFile.delete()
                            }
                            if (tmpFile.renameTo(logoFile)) {
                                return@withContext logoFile.absolutePath
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error downloading whitelabel logo", e)
        } finally {
            if (tmpFile.exists()) {
                tmpFile.delete()
            }
        }
        null
    }

    private suspend fun syncPlaylist(pocketbaseUrl: String, playlistId: String) = withContext(Dispatchers.IO) {
        val config = getOrCreateConfig()
        val serverUrl = config.serverUrl
        try {
            if (playlistId.equals("Normal", ignoreCase = true) || playlistId.equals("None", ignoreCase = true) || playlistId.isEmpty()) {
                if (assetDao.getAllAssets().isNotEmpty()) {
                    assetDao.clearAllAssets()
                }
                return@withContext
            }

            val actualId = if (playlistId.length != 15 || !playlistId.all { it.isLetterOrDigit() }) {
                val queryUrl = "${resolveUrl(pocketbaseUrl, pocketbaseUrl, serverUrl)}/api/collections/playlists/records?filter=name=\"$playlistId\""
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

            val url = "${resolveUrl(pocketbaseUrl, pocketbaseUrl, serverUrl)}/api/collections/playlists/records/$actualId"
            val response = apiService.getPlaylistRecord(url)

            Log.d("SignageRepository", "Synced playlist record name: ${response.name}")

            if (response.active == false) {
                Log.d("SignageRepository", "Playlist is inactive. Clearing device assets.")
                if (assetDao.getAllAssets().isNotEmpty()) {
                    assetDao.clearAllAssets()
                }
                return@withContext
            }

            // Store playlist settings (orientation, shuffle, loop, volume, transition) into the ScreenConfig
            val currentConfig = getOrCreateConfig()
            val logoUrlNow = if (response.websiteLogo.isNullOrEmpty()) (currentConfig.whiteLabelLogoUrl ?: "") else response.websiteLogo
            val isWhiteLabelNow = (response.whiteLabel == true) || currentConfig.isWhiteLabel
            val isLogoChanged = logoUrlNow.isNotEmpty() && currentConfig.whiteLabelLogoUrl != logoUrlNow
            val wasWhiteLabelLogoMissing = isWhiteLabelNow && (
                currentConfig.whiteLabelLogoPath.isNullOrEmpty() ||
                isLogoChanged ||
                !File(currentConfig.whiteLabelLogoPath ?: "").exists()
            )

            val updatedConfig = currentConfig.copy(
                playlistOrientation = response.orientation ?: "horizontal",
                playlistShuffle = response.shuffle ?: false,
                playlistLoop = response.loop ?: true,
                playlistVolume = response.volume?.toInt() ?: 80,
                playlistTransition = response.transition ?: "fade",
                widgetType = response.widgetType,
                widgetPlacement = response.widgetPlacement,
                widgetLink = response.widgetLink,
                isWhiteLabel = isWhiteLabelNow,
                whiteLabelLogoUrl = logoUrlNow,
                whiteLabelName = if (response.websiteName.isNullOrEmpty()) currentConfig.whiteLabelName else response.websiteName,
                whiteLabelLogoPath = if (isLogoChanged) null else currentConfig.whiteLabelLogoPath
            )
            configDao.saveConfig(updatedConfig)

            // Map response assets to local PlaylistAssets configuration
            val newAssets = mutableListOf<PlaylistAsset>()
            val cacheDir = File(context.filesDir, "signage_cache")

            // 1. Resolve from slides sequence (with custom durations, ordering, layout details)
            if (!response.slides.isNullOrEmpty()) {
                Log.d("SignageRepository", "Fetching metadata for ${response.slides.size} slides in parallel")
                val slideAssets = coroutineScope {
                    response.slides.mapIndexed { index, slide ->
                        async {
                            try {
                                val mediaId = slide.mediaId
                                val mediaItemUrl = "${resolveUrl(pocketbaseUrl, pocketbaseUrl, serverUrl)}/api/collections/media_items/records/$mediaId"
                                val mediaItem = apiService.getMediaItemRecord(mediaItemUrl)
                                
                                val fileUrl = if (!mediaItem.file.isNullOrEmpty()) {
                                    "$pocketbaseUrl/api/files/media_items/${mediaItem.id}/${mediaItem.file}"
                                } else {
                                    mediaItem.thumbnail
                                }
                                val finalUrl = resolveUrl(fileUrl, pocketbaseUrl, serverUrl)

                                val extension = ".jpg"
                                val filename = if (mediaItem.thumbnail.startsWith("data:")) {
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
                                val cacheFileName = getCacheFileName(finalUrl, filename)
                                val cacheFile = File(cacheDir, cacheFileName)
                                PlaylistAsset(
                                    id = slideId,
                                    url = finalUrl,
                                    filename = filename,
                                    localPath = if (cacheFile.exists()) cacheFile.absolutePath else null,
                                    mediaType = mediaItem.type.lowercase(),
                                    duration = slide.duration,
                                    sortOrder = index,
                                    checksum = mediaItem.checksum,
                                    width = mediaItem.width,
                                    height = mediaItem.height,
                                    fileSize = mediaItem.fileSize,
                                    fileSizeBytes = mediaItem.fileSizeBytes,
                                    mimeType = mediaItem.mimeType,
                                    youtubeVideoId = mediaItem.youtubeVideoId,
                                    objectFit = slide.objectFit ?: "cover",
                                    scalePercent = slide.scalePercent ?: 100
                                )
                            } catch (e: Exception) {
                                Log.e("SignageRepository", "Failed to fetch media item details for slide: ${slide.id}", e)
                                null
                            }
                        }
                    }.awaitAll().filterNotNull()
                }
                newAssets.addAll(slideAssets)
            }

            // 2. Fallback to Pocketbase assetsJson if present and slides was empty
            if (newAssets.isEmpty() && !response.assetsJson.isNullOrEmpty()) {
                response.assetsJson.forEachIndexed { index, pbAsset ->
                    val assetUrl = resolveUrl(pbAsset.url, pocketbaseUrl, serverUrl)
                    val cacheFileName = getCacheFileName(assetUrl, pbAsset.filename)
                    val cacheFile = File(cacheDir, cacheFileName)
                    newAssets.add(
                        PlaylistAsset(
                            id = "${playlistId}_${pbAsset.id}_$index",
                            url = assetUrl,
                            filename = pbAsset.filename,
                            localPath = if (cacheFile.exists()) cacheFile.absolutePath else null,
                            mediaType = pbAsset.mediaType.lowercase(),
                            duration = pbAsset.duration,
                            sortOrder = index,
                            checksum = pbAsset.checksum,
                            width = pbAsset.width,
                            height = pbAsset.height,
                            fileSize = pbAsset.fileSize,
                            fileSizeBytes = pbAsset.fileSizeBytes,
                            mimeType = pbAsset.mimeType,
                            youtubeVideoId = pbAsset.youtubeVideoId,
                            objectFit = pbAsset.objectFit ?: "cover",
                            scalePercent = pbAsset.scalePercent ?: 100
                        )
                    )
                }
            }

            // 3. Fallback to native files if attached and slides was empty
            if (newAssets.isEmpty() && response.files != null && response.files.isNotEmpty()) {
                response.files.forEachIndexed { index, fileName ->
                    val fileId = "${playlistId}_$index"
                    val fileUrl = "$pocketbaseUrl/api/files/playlists/$playlistId/$fileName"
                    val cacheFileName = getCacheFileName(fileUrl, fileName)
                    val cacheFile = File(cacheDir, cacheFileName)
                    newAssets.add(
                        PlaylistAsset(
                            id = fileId,
                            url = resolveUrl(fileUrl, pocketbaseUrl, serverUrl),
                            filename = fileName,
                            localPath = if (cacheFile.exists()) cacheFile.absolutePath else null,
                            mediaType = "image",
                            duration = 10,
                            sortOrder = index
                        )
                    )
                }
            }

            // 4. Fallback to mediaIds if slides, assetsJson, and files were all empty
            if (newAssets.isEmpty() && !response.mediaIds.isNullOrEmpty()) {
                Log.d("SignageRepository", "Fetching metadata for ${response.mediaIds.size} media IDs in parallel")
                val mediaAssets = coroutineScope {
                    response.mediaIds.mapIndexed { index, mediaId ->
                        async {
                            try {
                                val mediaItemUrl = "${resolveUrl(pocketbaseUrl, pocketbaseUrl, serverUrl)}/api/collections/media_items/records/$mediaId"
                                val mediaItem = apiService.getMediaItemRecord(mediaItemUrl)
                                
                                val fileUrl = if (!mediaItem.file.isNullOrEmpty()) {
                                    "$pocketbaseUrl/api/files/media_items/${mediaItem.id}/${mediaItem.file}"
                                } else {
                                    mediaItem.thumbnail
                                }
                                val finalUrl = resolveUrl(fileUrl, pocketbaseUrl, serverUrl)

                                val extension = ".jpg"
                                val filename = if (mediaItem.thumbnail.startsWith("data:")) {
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
                                val cacheFileName = getCacheFileName(finalUrl, filename)
                                val cacheFile = File(cacheDir, cacheFileName)
                                PlaylistAsset(
                                    id = slideId,
                                    url = finalUrl,
                                    filename = filename,
                                    localPath = if (cacheFile.exists()) cacheFile.absolutePath else null,
                                    mediaType = mediaItem.type.lowercase(),
                                    duration = mediaItem.duration,
                                    sortOrder = index,
                                    checksum = mediaItem.checksum,
                                    width = mediaItem.width,
                                    height = mediaItem.height,
                                    fileSize = mediaItem.fileSize,
                                    fileSizeBytes = mediaItem.fileSizeBytes,
                                    mimeType = mediaItem.mimeType,
                                    youtubeVideoId = mediaItem.youtubeVideoId
                                )
                            } catch (e: Exception) {
                                Log.e("SignageRepository", "Failed to fetch media item details for ID: $mediaId", e)
                                null
                            }
                        }
                    }.awaitAll().filterNotNull()
                }
                newAssets.addAll(mediaAssets)
            }

            if (newAssets.isNotEmpty()) {
                val currentAssetsList = assetDao.getAllAssets()
                // Shuffle only when the set of slides actually changed. Re-shuffling
                // on every sync made every poll look like a brand-new playlist, which
                // restarted playback from the first slide each time.
                val finalAssets = if (response.shuffle == true) {
                    val sameSlides = currentAssetsList.map { it.id }.sorted() == newAssets.map { it.id }.sorted()
                    if (sameSlides) {
                        val byId = newAssets.associateBy { it.id }
                        currentAssetsList.mapNotNull { byId[it.id] }
                    } else {
                        newAssets.shuffled()
                    }
                } else {
                    newAssets
                }.mapIndexed { index, asset -> asset.copy(sortOrder = index) }

                val mergedAssets = finalAssets

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
                            old.youtubeVideoId != new.youtubeVideoId ||
                            old.objectFit != new.objectFit ||
                            old.scalePercent != new.scalePercent
                        }

                if (hasChanged) {
                    // Atomic replace — clearing and inserting as two separate
                    // statements let a Flow observer see a momentary empty
                    // playlist mid-sync, which a screen mid-playback treats
                    // as a structural change (index reset, full player
                    // teardown/rebuild) even though nothing was actually
                    // meant to go blank here.
                    assetDao.replaceAllAssets(mergedAssets)
                    // No orphan cleanup here: the previous playlist's files keep
                    // playing until the new ones are downloaded. The download
                    // loop cleans up once it has finished.
                } else if (wasWhiteLabelLogoMissing) {
                    startDownloadingPendingAssets()
                }
            } else {
                if (assetDao.getAllAssets().isNotEmpty()) {
                    assetDao.clearAllAssets()
                    cleanupOrphanCacheFiles()
                }
                if (wasWhiteLabelLogoMissing) {
                    startDownloadingPendingAssets()
                }
            }
        } catch (e: Exception) {
            Log.e("SignageRepository", "Failed to sync playlist details", e)
        }
    }

    private var downloadJob: kotlinx.coroutines.Job? = null
    private var downloadRerunRequested = false
    private var downloadForceAllRequested = false

    private class DownloadAbortedException : Exception("Cache was cleared during download")

    /**
     * Starts the background downloader, or — if it is already running — asks it
     * to do one more pass when the current one finishes.
     *
     * This used to cancel the running job and start a new one. Cancelling a
     * coroutine does not interrupt a blocking OkHttp read, so the "cancelled"
     * job kept downloading next to the new one, both writing the same .tmp
     * files and deleting each other's work. Files then failed their checksum
     * or rename and never got a local path — leaving the screen stuck on
     * "Downloading media" (e.g. after pressing Sync in the dashboard).
     */
    fun startDownloadingPendingAssets(forceAll: Boolean = false) {
        synchronized(this) {
            if (forceAll) downloadForceAllRequested = true
            if (downloadJob?.isActive == true) {
                downloadRerunRequested = true
                return
            }
            downloadRerunRequested = false
            downloadJob = kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                runDownloadLoop()
            }
        }
    }

    private suspend fun runDownloadLoop() {
        var failureRetries = 0
        while (true) {
            val forceAll = synchronized(this) {
                val f = downloadForceAllRequested
                downloadForceAllRequested = false
                f
            }
            val startedAt = SystemClock.elapsedRealtime()
            var failures = 0
            var aborted = false
            try {
                failures = downloadPendingAssetsInternal(forceAll)
            } catch (e: DownloadAbortedException) {
                Log.d("SignageRepository", "Download run aborted (cache cleared); starting over.")
                aborted = true
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e("SignageRepository", "Error running background download job", e)
                failures = 1
            }

            if (aborted) {
                downloadStateFlow.value = DownloadState(isDownloading = false)
                continue
            }

            downloadRunCompletedFlow.value = startedAt

            val rerunPending = synchronized(this) { downloadRerunRequested || downloadForceAllRequested }
            if (!rerunPending) {
                // Give the player a moment to switch off the outgoing
                // playlist before its files are deleted.
                delay(3000)
                if (!synchronized(this) { downloadRerunRequested || downloadForceAllRequested }) {
                    cleanupOrphanCacheFiles()
                }
            }

            if (synchronized(this) { downloadRerunRequested.also { downloadRerunRequested = false } || downloadForceAllRequested }) {
                failureRetries = 0
                continue
            }

            if (failures > 0) {
                // Retry failed files with backoff (30s, 60s, ... capped at 5 min),
                // waking early if new work is requested in the meantime. This
                // used to give up after 5 tries (~7 min), so a TV that lost its
                // connection mid-download sat on the download screen until
                // someone rebooted it or changed the playlist.
                failureRetries++
                val waitUntil = SystemClock.elapsedRealtime() + (30_000L * failureRetries).coerceAtMost(300_000L)
                downloadStateFlow.value = downloadStateFlow.value.copy(nextRetryAt = waitUntil)
                while (SystemClock.elapsedRealtime() < waitUntil &&
                    !synchronized(this) { downloadRerunRequested || downloadForceAllRequested }) {
                    delay(1000)
                }
                synchronized(this) { downloadRerunRequested = false }
                continue
            }

            synchronized(this) {
                if (!downloadRerunRequested && !downloadForceAllRequested) {
                    downloadJob = null
                    return
                }
                downloadRerunRequested = false
            }
        }
    }

    /** One download pass. Returns the number of files that failed. */
    private suspend fun downloadPendingAssetsInternal(forceAll: Boolean = false): Int = withContext(Dispatchers.IO) {
        val generation = cacheGeneration
        var failures = 0
        // Bytes fetched this run, for the speed / time-left shown on the TV.
        var runBytes = 0L
        val runStart = SystemClock.elapsedRealtime()
        fun speedNow(): Long {
            val elapsed = SystemClock.elapsedRealtime() - runStart
            return if (elapsed > 1500 && runBytes > 0) runBytes * 1000 / elapsed else 0L
        }
        val config = getOrCreateConfig()
        val cacheDir = File(context.filesDir, "signage_cache")

        // Check if whitelabel logo needs downloading
        val logoNeedsDownload = config.isWhiteLabel && !config.whiteLabelLogoUrl.isNullOrEmpty() &&
                run {
                    val logoFileName = getCacheFileName(config.whiteLabelLogoUrl, "whitelabel_logo.png")
                    val logoFile = File(cacheDir, logoFileName)
                    !logoFile.exists() || config.whiteLabelLogoPath != logoFile.absolutePath
                }

        val assets = assetDao.getAllAssets()
        val pending = assets.filter {
            (it.mediaType.equals("image", ignoreCase = true) || it.mediaType.equals("video", ignoreCase = true)) &&
            (forceAll || it.localPath.isNullOrEmpty() || !File(it.localPath).exists())
        }

        if (pending.isEmpty() && !logoNeedsDownload) {
            downloadStateFlow.value = DownloadState(isDownloading = false)
            return@withContext 0
        }

        // Reset download state and clear errors at start of loop
        downloadStateFlow.value = DownloadState(
            isDownloading = true,
            totalFiles = pending.size,
            completedFiles = 0,
            currentFileProgress = 0f,
            currentFileName = "Initializing...",
            errorMessage = null
        )

        // 1. Download whitelabel logo first if enabled and missing/changed
        if (logoNeedsDownload) {
            Log.d("SignageRepository", "Whitelabel enabled. Downloading brand logo...")
            downloadStateFlow.value = DownloadState(
                isDownloading = true,
                totalFiles = pending.size,
                completedFiles = 0,
                currentFileProgress = 0f,
                currentFileName = "Brand Logo",
                errorMessage = null
            )
            
            val localPath = downloadWhiteLabelLogo(
                config.whiteLabelLogoUrl!!,
                totalFilesForProgress = 0,
                completedFilesForProgress = 0
            )
            if (localPath != null) {
                val updated = getOrCreateConfig().copy(whiteLabelLogoPath = localPath)
                configDao.saveConfig(updated)
                Log.d("SignageRepository", "Whitelabel logo cached at: $localPath")
            } else {
                failures++
                downloadStateFlow.value = downloadStateFlow.value.copy(
                    errorMessage = "Failed to download brand logo"
                )
            }
        }

        if (pending.isEmpty()) {
            val currentError = downloadStateFlow.value.errorMessage
            downloadStateFlow.value = DownloadState(isDownloading = false, errorMessage = currentError)
            return@withContext failures
        }

        val totalToDownload = pending.size
        val startIndex = 0

        pending.forEachIndexed { index, asset ->
            if (generation != cacheGeneration) throw DownloadAbortedException()
            val tStart = System.currentTimeMillis()
            Log.d("DownloadMetrics", "--------------------------------------------------")
            Log.d("DownloadMetrics", "Download Started (${index + 1}/$totalToDownload): ${asset.filename} (${asset.url})")

            downloadStateFlow.value = DownloadState(
                isDownloading = true,
                totalFiles = totalToDownload,
                completedFiles = startIndex + index,
                currentFileProgress = 0.0f,
                currentFileName = asset.filename,
                downloadedBytes = 0L,
                totalFileBytes = 0L,
                errorMessage = downloadStateFlow.value.errorMessage
            )

            val localFile = if (!asset.localPath.isNullOrEmpty()) {
                File(asset.localPath)
            } else {
                File(cacheDir, getCacheFileName(asset.url, asset.filename))
            }
            val tmpFile = File(localFile.absolutePath + ".tmp")

            try {
                if (asset.url.startsWith("data:", ignoreCase = true)) {
                    val commaIndex = asset.url.indexOf(",")
                    if (commaIndex != -1) {
                        val base64Data = asset.url.substring(commaIndex + 1)
                        val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                        FileOutputStream(tmpFile).use { outputStream ->
                            outputStream.write(bytes)
                        }

                        if (!asset.checksum.isNullOrEmpty()) {
                            val calculated = calculateSHA256(tmpFile)
                            if (!calculated.equals(asset.checksum, ignoreCase = true)) {
                                throw Exception("Checksum verification failed for base64 asset. Expected: ${asset.checksum}, got: $calculated")
                            }
                        }

                        if (localFile.exists()) {
                            localFile.delete()
                        }
                        if (tmpFile.renameTo(localFile)) {
                            assetDao.updateLocalPath(asset.id, localFile.absolutePath)
                        } else {
                            throw Exception("Failed to rename temporary file to local path")
                        }

                        downloadStateFlow.value = DownloadState(
                            isDownloading = true,
                            totalFiles = totalToDownload,
                            completedFiles = startIndex + index + 1,
                            currentFileProgress = 0.0f,
                            currentFileName = asset.filename,
                            downloadedBytes = bytes.size.toLong(),
                            totalFileBytes = bytes.size.toLong(),
                            errorMessage = downloadStateFlow.value.errorMessage
                        )
                        Log.d("SignageRepository", "Base64 asset cached successfully to: ${localFile.absolutePath}")
                    } else {
                        throw Exception("Invalid data URL format")
                    }
                } else {
                    val tConnStart = System.currentTimeMillis()
                    val request = Request.Builder().url(asset.url).build()

                    okHttpClient.newCall(request).execute().use { response ->
                        val tHeaders = System.currentTimeMillis()
                        Log.d("DownloadMetrics", "Connection Opened / Headers Received: ${asset.filename} in ${tHeaders - tConnStart} ms")

                        if (!response.isSuccessful) throw Exception("Failed download status: ${response.code}")
                        val body = response.body ?: throw Exception("Null response body")
                        val contentLength = body.contentLength()
                        val tStreamStart = System.currentTimeMillis()

                        body.byteStream().use { inputStream ->
                            FileOutputStream(tmpFile).use { outputStream ->
                                val buffer = ByteArray(64 * 1024)
                                var bytesRead: Int
                                var totalBytesRead = 0L
                                var lastProgressMs = 0L

                                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                                    if (generation != cacheGeneration) throw DownloadAbortedException()
                                    outputStream.write(buffer, 0, bytesRead)
                                    totalBytesRead += bytesRead
                                    runBytes += bytesRead

                                    val now = System.currentTimeMillis()
                                    if (now - lastProgressMs > 100) {
                                        lastProgressMs = now
                                        val progress = if (contentLength > 0) totalBytesRead.toFloat() / contentLength else 0f
                                        downloadStateFlow.value = DownloadState(
                                            isDownloading = true,
                                            totalFiles = totalToDownload,
                                            completedFiles = startIndex + index,
                                            currentFileProgress = progress.coerceIn(0f, 1f),
                                            currentFileName = asset.filename,
                                            downloadedBytes = totalBytesRead,
                                            totalFileBytes = contentLength,
                                            errorMessage = downloadStateFlow.value.errorMessage,
                                            bytesPerSecond = speedNow()
                                        )
                                    }
                                }

                                val tStreamEnd = System.currentTimeMillis()
                                val streamDurMs = Math.max(1L, tStreamEnd - tStreamStart)
                                val streamMB = totalBytesRead / (1024.0 * 1024.0)
                                val streamMBps = streamMB / (streamDurMs / 1000.0)
                                Log.d("DownloadMetrics", "Streaming Completed: ${asset.filename} (${String.format("%.2f", streamMB)} MB in ${streamDurMs} ms | Speed: ${String.format("%.2f", streamMBps)} MB/s)")
                            }
                        }
                    }

                    val tVerificationStart = System.currentTimeMillis()
                    if (!asset.checksum.isNullOrEmpty()) {
                        val calculated = calculateSHA256(tmpFile)
                        if (!calculated.equals(asset.checksum, ignoreCase = true)) {
                            throw Exception("Checksum verification failed for downloaded asset. Expected: ${asset.checksum}, got: $calculated")
                        }
                    }

                    if (localFile.exists()) {
                        localFile.delete()
                    }
                    if (tmpFile.renameTo(localFile)) {
                        assetDao.updateLocalPath(asset.id, localFile.absolutePath)
                    } else {
                        throw Exception("Failed to rename temporary file to local path")
                    }

                    val tEnd = System.currentTimeMillis()
                    val totalDurMs = Math.max(1L, tEnd - tStart)
                    val totalMB = localFile.length() / (1024.0 * 1024.0)
                    val overallMBps = totalMB / (totalDurMs / 1000.0)
                    Log.d("DownloadMetrics", "Disk Write & Verification Completed: ${asset.filename} in ${tEnd - tVerificationStart} ms")
                    Log.d("DownloadMetrics", "TOTAL DURATION: ${asset.filename} | Total Time: ${totalDurMs} ms | Net Speed: ${String.format("%.2f", overallMBps)} MB/s")

                    downloadStateFlow.value = DownloadState(
                        isDownloading = true,
                        totalFiles = totalToDownload,
                        completedFiles = startIndex + index + 1,
                        currentFileProgress = 0.0f,
                        currentFileName = asset.filename,
                        downloadedBytes = localFile.length(),
                        totalFileBytes = localFile.length(),
                        errorMessage = downloadStateFlow.value.errorMessage
                    )
                }
            } catch (e: Exception) {
                if (tmpFile.exists()) {
                    tmpFile.delete()
                }
                if (e is DownloadAbortedException || e is kotlinx.coroutines.CancellationException) throw e
                if (generation != cacheGeneration) throw DownloadAbortedException()
                failures++
                Log.e("SignageRepository", "Failed to download asset: ${asset.url}", e)
                val (friendly, offline) = friendlyDownloadError(e)
                downloadStateFlow.value = DownloadState(
                    isDownloading = true,
                    totalFiles = totalToDownload,
                    completedFiles = startIndex + index + 1,
                    currentFileProgress = 0.0f,
                    currentFileName = asset.filename,
                    errorMessage = friendly,
                    bytesPerSecond = speedNow(),
                    offline = offline
                )
                sendDiagnosticsHeartbeat("Playback/Download Error: Failed to download or verify checksum of ${asset.filename} (${e.message})")
            }
        }
        val last = downloadStateFlow.value
        downloadStateFlow.value = DownloadState(
            isDownloading = false,
            errorMessage = if (failures > 0) last.errorMessage else null,
            offline = failures > 0 && last.offline
        )
        failures
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

    // (PocketBase realtime/SSE subscription removed: it subscribed to every
    // tenant's playlists and media, so any change anywhere made every TV
    // re-sync at once, while changes to this screen's own record never
    // arrived. The server pushes "config changed" over the socket held by
    // VideoCallManager instead, backed by the periodic poll.)

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
                screenId = config.screenId.ifEmpty { null },
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

    suspend fun sendOfflineNotification(reason: String = "App closed by user"): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val config = getOrCreateConfig()
            val url = "${config.serverUrl}/api/v1/devices/offline"
            val body = mapOf(
                "hardwareUuid" to config.hardwareUuid,
                "reason" to reason
            )
            val response = apiService.reportOffline(url, body)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to report offline: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error sending offline notification", e)
            Result.failure(e)
        }
    }

    private fun getCpuTemperature(): Double? {
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
            // No readable sensor: report nothing rather than a made-up value
            // (this used to send a random 45–53°C, shown as real data).
            null
        } catch (e: Exception) {
            null
        }
    }

    // Direct helper to clear the cache for testing configurations
    suspend fun clearCache() = withContext(Dispatchers.IO) {
        cacheGeneration++
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



    suspend fun updateDeviceVolume(volume: Int) = withContext(Dispatchers.IO) {
        try {
            val config = getOrCreateConfig()
            val updatedConfig = config.copy(screenVolume = volume)
            configDao.saveConfig(updatedConfig)
            
            if (config.screenId.isNotEmpty() && config.pocketbaseUrl.isNotEmpty()) {
                acknowledge(config, mapOf("volume" to volume))
                Log.d("SignageRepository", "Successfully updated volume on server to: $volume")
            }
        } catch (e: Exception) {
            Log.e("SignageRepository", "Failed to update device volume", e)
            logErrorToServer("Update Volume Failure", e.message ?: "Unknown error")
        }
    }

    private fun isEmulator(): Boolean {
        val brand = android.os.Build.BRAND
        val device = android.os.Build.DEVICE
        val model = android.os.Build.MODEL
        val hardware = android.os.Build.HARDWARE
        val product = android.os.Build.PRODUCT
        val fingerprint = android.os.Build.FINGERPRINT
        return brand.startsWith("generic") ||
                device.startsWith("generic") ||
                model.contains("google_sdk") ||
                model.contains("Emulator") ||
                model.contains("Android SDK built for x86") ||
                hardware.contains("goldfish") ||
                hardware.contains("ranchu") ||
                product.contains("sdk_google") ||
                fingerprint.startsWith("generic")
    }

    private fun getReplacementHost(serverUrl: String): String {
        return try {
            val uri = java.net.URI(serverUrl)
            val host = uri.host ?: ""
            if (host == "localhost" || host == "127.0.0.1" || host.isEmpty()) {
                if (isEmulator()) "10.0.2.2" else "127.0.0.1"
            } else {
                host
            }
        } catch (e: Exception) {
            if (isEmulator()) "10.0.2.2" else "127.0.0.1"
        }
    }

    suspend fun logErrorToServer(event: String, detail: String) {
        try {
            val config = getOrCreateConfig()
            if (config.screenId.isEmpty()) return
            // /devices/log is verified by hardware id. This used to post to
            // /screen_logs, which needs a dashboard login, so every report was
            // rejected and never reached the screen's logs.
            val url = "${config.serverUrl}/api/v1/devices/log"
            val fields = mapOf(
                "screenId" to config.screenId,
                "hardwareUuid" to config.hardwareUuid,
                "event" to redactText(event, config.pocketbaseUrl, config.serverUrl),
                "type" to "error",
                "detail" to redactText(detail, config.pocketbaseUrl, config.serverUrl)
            )
            apiService.postLog(url, fields)
        } catch (e: Exception) {
            Log.e("SignageRepository", "Failed to send error log to server: ${e.message}", e)
        }
    }

    suspend fun disconnectDevice(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val config = getOrCreateConfig()
            if (config.hardwareUuid.isEmpty()) {
                return@withContext Result.failure(IllegalStateException("No hardware UUID available"))
            }

            val url = "${config.serverUrl}/api/v1/screens/disconnect"
            val response = apiService.disconnectScreen(url, mapOf("hardwareUuid" to config.hardwareUuid))
            if (response.isSuccessful) {
                val updatedConfig = config.copy(
                    status = "pairing",
                    pairingCode = ""
                )
                configDao.saveConfig(updatedConfig)
                clearDeviceAssets()
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to disconnect from server: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e("SignageRepository", "Error disconnecting device", e)
            Result.failure(e)
        }
    }
}


