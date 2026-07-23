package com.example.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.database.PlaylistAsset
import com.example.data.database.ScreenConfig
import com.example.data.repository.SignageRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class SignageUiState(
    val hardwareUuid: String = "",
    val screenId: String = "",
    val pairingCode: String = "",
    val status: String = "pairing", // "pairing", "active", "suspended"
    val screenName: String = "Digital Signage",
    val serverUrl: String = com.example.AppConfig.SERVER_URL,
    val pocketbaseUrl: String = com.example.AppConfig.POCKETBASE_URL,
    val lastSyncedAt: Long = 0L,
    val playlist: List<PlaylistAsset> = emptyList(),
    val currentAssetIndex: Int = 0,
    val isSyncing: Boolean = false,
    val showAdminOverlay: Boolean = false,
    val statusMessage: String = "Initializing system...",
    val errorMessage: String? = null,
    val isDownloading: Boolean = false,
    val downloadProgressMessage: String = "",
    val downloadProgressFraction: Float = 0f,
    val downloadedBytes: Long = 0L,
    val totalBytes: Long = 0L,
    val showSplash: Boolean = true,
    // Playlist playback settings
    val playlistOrientation: String = "vertical", // "horizontal" | "vertical"
    val playlistShuffle: Boolean = false,
    val playlistLoop: Boolean = true,
    val playlistVolume: Int = 80,
    val playlistTransition: String = "fade",
    val screenVolume: Int = 80,
    val widgetType: String? = null,
    val widgetPlacement: String? = null,
    val widgetLink: String? = null,
    val isWhiteLabel: Boolean = false,
    val whiteLabelLogoUrl: String? = null,
    val whiteLabelLogoPath: String? = null,
    val whiteLabelName: String? = null,
    val isConfigLoaded: Boolean = false
)

class SignageViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = SignageRepository(application)

    private val _uiState = MutableStateFlow(SignageUiState())
    val uiState: StateFlow<SignageUiState> = _uiState.asStateFlow()

    private var syncJob: Job? = null
    private var heartbeatJob: Job? = null
    private var assetRotationJob: Job? = null

    init {
        // Collect repository commands
        viewModelScope.launch {
            repository.commandFlow.collect { command ->
                if (command == "restart_playlist") {
                    Log.d("SignageViewModel", "Received restart_playlist command. Resetting asset index to 0.")
                    _uiState.update { it.copy(currentAssetIndex = 0) }
                    restartAssetRotation(force = true)
                }
            }
        }

        // Collect database config state
        viewModelScope.launch {
            repository.configFlow.collectLatest { config ->
                if (config != null) {
                    val oldStatus = _uiState.value.status
                    val newStatus = config.status
                    val statusChanged = oldStatus != newStatus
                    _uiState.update {
                        it.copy(
                            hardwareUuid = config.hardwareUuid,
                            screenId = config.screenId,
                            pairingCode = config.pairingCode,
                            status = config.status,
                            screenName = config.screenName,
                            serverUrl = config.serverUrl,
                            pocketbaseUrl = config.pocketbaseUrl,
                            lastSyncedAt = config.lastSyncedAt,
                            playlistOrientation = config.playlistOrientation,
                            playlistShuffle = config.playlistShuffle,
                            playlistLoop = config.playlistLoop,
                            playlistVolume = config.playlistVolume,
                            playlistTransition = config.playlistTransition,
                            screenVolume = config.screenVolume,
                            widgetType = config.widgetType,
                            widgetPlacement = config.widgetPlacement,
                            widgetLink = config.widgetLink,
                            isWhiteLabel = config.isWhiteLabel,
                            whiteLabelLogoUrl = config.whiteLabelLogoUrl,
                            whiteLabelLogoPath = config.whiteLabelLogoPath,
                            whiteLabelName = config.whiteLabelName,
                            isConfigLoaded = true
                        )
                    }
                    // Start or update asset rotational loop based on playlist changes
                    if (statusChanged) {
                        restartAssetRotation(force = true)
                    } else {
                        restartAssetRotation(force = false)
                    }
                } else {
                    // Pre-create configuration
                    repository.getOrCreateConfig()
                }
            }
        }

        // Collect database playlist state
        viewModelScope.launch {
            repository.assetsFlow.collectLatest { assets ->
                val filteredAssets = assets.filter {
                    it.mediaType.equals("image", ignoreCase = true) ||
                    it.mediaType.equals("video", ignoreCase = true)
                }
                val oldPlaylist = _uiState.value.playlist
                val structurallyEqual = isPlaylistStructurallyEqual(oldPlaylist, filteredAssets)
                val downloadsJustFinished = !areAllAssetsDownloaded(oldPlaylist) && areAllAssetsDownloaded(filteredAssets)

                _uiState.update { 
                    it.copy(
                        playlist = filteredAssets,
                        currentAssetIndex = if (!structurallyEqual || downloadsJustFinished) 0 else it.currentAssetIndex
                    )
                }
                if (!structurallyEqual || downloadsJustFinished) {
                    restartAssetRotation(force = true)
                    if (!structurallyEqual) {
                        repository.startDownloadingPendingAssets()
                    }
                } else {
                    restartAssetRotation(force = false)
                }
            }
        }

        // Collect repository download state progress
        viewModelScope.launch {
            repository.downloadStateFlow.collectLatest { downloadState ->
                _uiState.update {
                    val totalAssets = it.playlist.size

                    val progressMessage = if (downloadState.isDownloading && downloadState.totalFiles > 0) {
                        if (downloadState.totalBytes > 0) {
                            val downloadedMB = downloadState.downloadedBytes.toFloat() / (1024 * 1024)
                            val totalMB = downloadState.totalBytes.toFloat() / (1024 * 1024)
                            String.format(java.util.Locale.US, "Downloaded: %.1f MB / %.1f MB", downloadedMB, totalMB)
                        } else {
                            val alreadyCached = (totalAssets - downloadState.totalFiles).coerceAtLeast(0)
                            val displayCompleted = (alreadyCached + downloadState.completedFiles + 1).coerceAtMost(totalAssets)
                            "Downloading ${downloadState.currentFileName} ($displayCompleted/$totalAssets)"
                        }
                    } else {
                        ""
                    }
                    
                    val overallProgress = if (it.playlist.isNotEmpty()) {
                        val totalAssets = it.playlist.size
                        val alreadyDownloaded = it.playlist.count { asset ->
                            asset.mediaType.equals("youtube", ignoreCase = true) || 
                            (!asset.localPath.isNullOrEmpty() && java.io.File(asset.localPath).exists())
                        }
                        
                        if (totalAssets > 0) {
                            if (downloadState.isDownloading && downloadState.totalFiles > 0) {
                                if (downloadState.totalBytes > 0) {
                                    (downloadState.downloadedBytes.toFloat() / downloadState.totalBytes.toFloat()).coerceIn(0f, 1f)
                                } else {
                                    val pendingCount = downloadState.totalFiles
                                    val initialDownloadedCount = totalAssets - pendingCount
                                    ((initialDownloadedCount.toFloat() + downloadState.completedFiles + downloadState.currentFileProgress) / totalAssets).coerceIn(0f, 1f)
                                }
                            } else {
                                (alreadyDownloaded.toFloat() / totalAssets).coerceIn(0f, 1f)
                            }
                        } else {
                            0f
                        }
                    } else {
                        0f
                    }
                    
                    it.copy(
                        isDownloading = downloadState.isDownloading,
                        downloadProgressMessage = progressMessage,
                        downloadProgressFraction = overallProgress,
                        downloadedBytes = downloadState.downloadedBytes,
                        totalBytes = downloadState.totalBytes,
                        errorMessage = downloadState.errorMessage
                    )
                }
            }
        }

        // Start dynamic sync and diagnostics background services
        startSyncEngine()
        startDiagnosticsHeartbeatEngine()
        repository.startRealtimeSync()

        // Generate initial pairing code request if setup is needed
        viewModelScope.launch {
            val current = repository.getOrCreateConfig()
            if (current.pairingCode.isEmpty() && current.screenId.isEmpty()) {
                requestPairingCode()
            }
        }

        // If already whitelabeled from a previous session, kick off logo download immediately
        // so it's ready before the splash screen dismisses
        viewModelScope.launch {
            val current = repository.getOrCreateConfig()
            if (current.isWhiteLabel && !current.whiteLabelLogoUrl.isNullOrEmpty()) {
                repository.startDownloadingPendingAssets()
            }
        }

        // Smart splash dismissal — wait for the whitelabel logo to be cached before
        // dismissing the splash (up to 6 seconds max), then fall through regardless.
        viewModelScope.launch {
            delay(1000) // minimum splash visibility
            val maxWaitMs = 5000L
            val startTime = System.currentTimeMillis()
            while (System.currentTimeMillis() - startTime < maxWaitMs) {
                val state = _uiState.value
                if (state.isConfigLoaded) {
                    // Once config is loaded from the database, evaluate the whitelabel logo condition
                    if (!state.isWhiteLabel || !state.whiteLabelLogoPath.isNullOrEmpty()) {
                        break
                    }
                }
                delay(200)
            }
            _uiState.update { it.copy(showSplash = false) }
        }
    }

    fun requestPairingCode() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, statusMessage = "Generating pairing code...") }
            val result = repository.requestPairingCode()
            _uiState.update { state ->
                if (result.isSuccess) {
                    val config = result.getOrNull()
                    state.copy(
                        isSyncing = false,
                        pairingCode = config?.pairingCode ?: "",
                        screenId = config?.screenId ?: "",
                        statusMessage = "Awaiting pairing from Bluestar CMS..."
                    )
                } else {
                    state.copy(
                        isSyncing = false,
                        errorMessage = "Pairing failed: " + result.exceptionOrNull()?.message,
                        statusMessage = "Network retry active..."
                    )
                }
            }
        }
    }

    private fun startSyncEngine() {
        syncJob?.cancel()
        syncJob = viewModelScope.launch {
            while (isActive) {
                try {
                    val config = repository.getOrCreateConfig()
                    if (config.screenId.isNotEmpty()) {
                        _uiState.update { it.copy(isSyncing = true) }
                        repository.syncScreenStatus()
                        _uiState.update { it.copy(isSyncing = false) }
                    } else if (config.pairingCode.isEmpty()) {
                        repository.requestPairingCode()
                    }
                } catch (e: Exception) {
                    Log.e("SignageViewModel", "Background sync failure", e)
                    _uiState.update { it.copy(isSyncing = false) }
                }
                // Poll screen stats and pairing actions every 7.5 seconds
                delay(7500)
            }
        }
    }

    private fun startDiagnosticsHeartbeatEngine() {
        heartbeatJob?.cancel()
        heartbeatJob = viewModelScope.launch {
            while (isActive) {
                try {
                    val state = _uiState.value
                    if (state.status == "active" || state.status == "online" || state.status == "offline") {
                        val currentAsset = state.playlist.getOrNull(state.currentAssetIndex)
                        repository.sendDiagnosticsHeartbeat(currentAsset?.filename)
                    }
                } catch (e: Exception) {
                    Log.e("SignageViewModel", "Heartbeat broadcast failed", e)
                }
                // Broadcase diagnostic heartbeats once a minute
                delay(60000)
            }
        }
    }

    private fun areAllAssetsDownloaded(playlist: List<com.example.data.database.PlaylistAsset>): Boolean {
        if (playlist.isEmpty()) return false
        return playlist.all { asset ->
            asset.mediaType.equals("youtube", ignoreCase = true) ||
            (!asset.localPath.isNullOrEmpty() && java.io.File(asset.localPath).exists())
        }
    }

    private fun isPlaylistStructurallyEqual(list1: List<PlaylistAsset>, list2: List<PlaylistAsset>): Boolean {
        if (list1.size != list2.size) return false
        for (i in list1.indices) {
            val a1 = list1[i]
            val a2 = list2[i]
            if (a1.id != a2.id || a1.url != a2.url || a1.duration != a2.duration || a1.mediaType != a2.mediaType) {
                return false
            }
        }
        return true
    }

    private fun restartAssetRotation(force: Boolean = false) {
        if (!force && assetRotationJob?.isActive == true) {
            return
        }
        assetRotationJob?.cancel()
        val playlist = _uiState.value.playlist
        if (playlist.isEmpty() || (_uiState.value.status != "active" && _uiState.value.status != "online" && _uiState.value.status != "offline")) {
            return
        }
        if (!areAllAssetsDownloaded(playlist)) {
            return
        }

        assetRotationJob = viewModelScope.launch {
            while (isActive) {
                // Always read live state to avoid stale snapshot
                val state = _uiState.value
                val livePlaylist = state.playlist
                val currentIndex = state.currentAssetIndex

                if (livePlaylist.isEmpty()) break
                if (state.status != "active" && state.status != "online" && state.status != "offline") break

                val currentAsset = livePlaylist.getOrNull(currentIndex) ?: break

                if (currentAsset.mediaType.equals("video", ignoreCase = true)) {
                    // Wait for video player completion callback to trigger advanceToNextAsset
                    delay(3600000L) // 1 hour safety delay fallback
                    continue
                }

                val durationMs = (currentAsset.duration * 1000L).coerceAtLeast(3000L) // Min 3 seconds
                delay(durationMs)

                // Advance to next, wrapping around (always loop)
                _uiState.update { s ->
                    val livePl = s.playlist
                    if (livePl.isEmpty()) return@update s
                    val nextIndex = (s.currentAssetIndex + 1) % livePl.size
                    s.copy(currentAssetIndex = nextIndex)
                }
            }
        }
    }

    fun advanceToNextAsset() {
        val playlist = _uiState.value.playlist
        if (playlist.isNotEmpty()) {
            _uiState.update {
                val nextIndex = (it.currentAssetIndex + 1) % playlist.size
                it.copy(currentAssetIndex = nextIndex)
            }
            restartAssetRotation(force = true)
        }
    }



    fun saveVolumeSettings(volume: Int) {
        viewModelScope.launch {
            try {
                repository.updateDeviceVolume(volume)
            } catch (e: Exception) {
                Log.e("SignageViewModel", "Failed to save volume settings", e)
                repository.logErrorToServer("Save Volume Failure", e.message ?: "Unknown error")
            }
        }
    }

    fun purgeCacheAndReset() {
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isSyncing = true, statusMessage = "Purging offline database..." ) }
                repository.clearCache()
                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        currentAssetIndex = 0,
                        statusMessage = "Cleared. Ready to pair."
                    )
                }
                requestPairingCode()
            } catch (e: Exception) {
                Log.e("SignageViewModel", "Failed to purge cache and reset", e)
                repository.logErrorToServer("Purge Cache & Reset Failure", e.message ?: "Unknown error")
            }
        }
    }

    fun disconnectDevice() {
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isSyncing = true, statusMessage = "Disconnecting device...") }
                val result = repository.disconnectDevice()
                _uiState.update { state ->
                    if (result.isSuccess) {
                        state.copy(
                            isSyncing = false,
                            status = "pairing",
                            pairingCode = "",
                            statusMessage = "Disconnected successfully."
                        )
                    } else {
                        state.copy(
                            isSyncing = false,
                            errorMessage = "Disconnect failed: " + result.exceptionOrNull()?.message,
                            statusMessage = "Disconnect failed"
                        )
                    }
                }
                requestPairingCode()
            } catch (e: Exception) {
                Log.e("SignageViewModel", "Failed to disconnect device", e)
                _uiState.update { it.copy(isSyncing = false, errorMessage = e.message) }
            }
        }
    }



    fun triggerPendingDownloads() {
        try {
            repository.startDownloadingPendingAssets()
        } catch (e: Exception) {
            Log.e("SignageViewModel", "Failed to trigger pending downloads", e)
        }
    }

    fun reportPlaybackError(assetName: String, errorDetails: String) {
        viewModelScope.launch {
            try {
                repository.sendDiagnosticsHeartbeat("Playback Error: $assetName ($errorDetails)")
                repository.logErrorToServer("Playback Error", "Asset: $assetName, Detail: $errorDetails")
            } catch (e: Exception) {
                Log.e("SignageViewModel", "Failed to report playback error", e)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        syncJob?.cancel()
        heartbeatJob?.cancel()
        assetRotationJob?.cancel()

        kotlinx.coroutines.runBlocking {
            try {
                repository.sendOfflineNotification("App was closed / process terminated.")
            } catch (e: Exception) {
                Log.e("SignageViewModel", "Failed to send offline notification on clear", e)
            }
        }
    }
}
