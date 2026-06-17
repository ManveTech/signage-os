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
    val serverUrl: String = "http://10.0.2.2:5000",
    val pocketbaseUrl: String = "http://10.0.2.2:8090",
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
    val whiteLabelLogoPath: String? = null,
    val whiteLabelName: String? = null
)

class SignageViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = SignageRepository(application)

    private val _uiState = MutableStateFlow(SignageUiState())
    val uiState: StateFlow<SignageUiState> = _uiState.asStateFlow()

    private var syncJob: Job? = null
    private var heartbeatJob: Job? = null
    private var assetRotationJob: Job? = null

    init {
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
                            whiteLabelLogoPath = config.whiteLabelLogoPath,
                            whiteLabelName = config.whiteLabelName
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
                val oldPlaylist = _uiState.value.playlist
                val structurallyEqual = isPlaylistStructurallyEqual(oldPlaylist, assets)
                _uiState.update { 
                    it.copy(
                        playlist = assets,
                        currentAssetIndex = if (!structurallyEqual) 0 else it.currentAssetIndex
                    )
                }
                if (!structurallyEqual) {
                    restartAssetRotation(force = true)
                } else {
                    restartAssetRotation(force = false)
                }
                repository.startDownloadingPendingAssets()
            }
        }

        // Collect repository download state progress
        viewModelScope.launch {
            repository.downloadStateFlow.collectLatest { downloadState ->
                _uiState.update {
                    val progressMessage = if (downloadState.isDownloading) {
                        "Downloading ${downloadState.currentFileName} (${downloadState.completedFiles + 1}/${downloadState.totalFiles})"
                    } else {
                        ""
                    }
                    val overallProgress = if (downloadState.totalFiles > 0) {
                        (downloadState.completedFiles.toFloat() + downloadState.currentFileProgress) / downloadState.totalFiles
                    } else {
                        0f
                    }
                    it.copy(
                        isDownloading = downloadState.isDownloading,
                        downloadProgressMessage = progressMessage,
                        downloadProgressFraction = overallProgress
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
                // Dismiss as soon as: not whitelabeled, or logo path is already cached
                if (!state.isWhiteLabel || !state.whiteLabelLogoPath.isNullOrEmpty()) {
                    break
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
                    if (state.status == "active" || state.status == "online") {
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
        if (playlist.isEmpty() || (_uiState.value.status != "active" && _uiState.value.status != "online")) {
            return
        }

        assetRotationJob = viewModelScope.launch {
            while (isActive) {
                val currentIndex = _uiState.value.currentAssetIndex
                val currentAsset = playlist.getOrNull(currentIndex) ?: break

                if (currentAsset.mediaType.equals("video", ignoreCase = true)) {
                    // Wait for video player completion callback to trigger advanceToNextAsset
                    delay(3600000L) // 1 hour safety delay fallback
                    continue
                }

                val durationMs = (currentAsset.duration * 1000L).coerceAtLeast(3000L) // Min 3 seconds

                delay(durationMs)

                // Advance to the next playlist asset looping
                _uiState.update {
                    val nextIndex = if (playlist.isNotEmpty()) (it.currentAssetIndex + 1) % playlist.size else 0
                    it.copy(currentAssetIndex = nextIndex)
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

    fun saveServerUrls(serverUrl: String, pocketbaseUrl: String) {
        viewModelScope.launch {
            repository.updateServerUrls(serverUrl, pocketbaseUrl)
            hideAdminOverlay()
            repository.startRealtimeSync()
            // Reset state and re-request code
            requestPairingCode()
        }
    }

    fun saveVolumeSettings(volume: Int) {
        viewModelScope.launch {
            repository.updateDeviceVolume(volume)
        }
    }

    fun purgeCacheAndReset() {
        viewModelScope.launch {
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
        }
    }

    fun toggleAdminOverlay() {
        _uiState.update { it.copy(showAdminOverlay = !it.showAdminOverlay) }
    }

    fun hideAdminOverlay() {
        _uiState.update { it.copy(showAdminOverlay = false) }
    }

    fun testWithSimulatedDemo() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, statusMessage = "Injecting sample promotional files..." ) }
            repository.injectDemoPlaylist()
            _uiState.update {
                it.copy(
                    isSyncing = false,
                    status = "active",
                    statusMessage = "Demo Active"
                )
            }
            restartAssetRotation()
        }
    }
    
    fun simulateLicenceSuspended() {
        viewModelScope.launch {
            _uiState.update { it.copy(status = "suspended", statusMessage = "License suspended simulation" ) }
        }
    }

    fun triggerPendingDownloads() {
        repository.startDownloadingPendingAssets()
    }

    fun reportPlaybackError(assetName: String, errorDetails: String) {
        viewModelScope.launch {
            repository.sendDiagnosticsHeartbeat("Playback Error: $assetName ($errorDetails)")
        }
    }
}
