package com.example.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.call.VideoCallManager
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
import kotlin.random.Random

data class SignageUiState(
    val hardwareUuid: String = "",
    val screenId: String = "",
    val pairingCode: String = "",
    val status: String = "pairing", // "pairing", "active", "suspended"
    val screenName: String = "Digital Signage",
    val serverUrl: String = com.example.AppConfig.SERVER_URL,
    val pocketbaseUrl: String = com.example.AppConfig.POCKETBASE_URL,
    val lastSyncedAt: Long = 0L,
    // The assigned playlist, exactly as synced (some files may still be downloading).
    val playlist: List<PlaylistAsset> = emptyList(),
    // What is actually on screen: the assigned playlist once its files are
    // downloaded, the previous playlist while a new one is still downloading,
    // or the downloaded subset if some files can't be fetched.
    // currentAssetIndex indexes into THIS list.
    val playbackPlaylist: List<PlaylistAsset> = emptyList(),
    val currentAssetIndex: Int = 0,
    val isSyncing: Boolean = false,
    val showAdminOverlay: Boolean = false,
    val statusMessage: String = "Initializing system...",
    val errorMessage: String? = null,
    val isDownloading: Boolean = false,
    val downloadProgressMessage: String = "",
    val downloadProgressFraction: Float = 0f,
    // Raw figures behind downloadProgressMessage, so the sync screen can lay
    // them out itself instead of parsing the one-line message string.
    val downloadCurrentFile: String = "",
    val downloadCurrentBytes: Long = 0L,
    val downloadCurrentTotalBytes: Long = 0L,
    // Whole-playlist figures for the download screen (bytes, when the server
    // reports file sizes; otherwise 0 and the screen falls back to counts).
    val downloadBytesDone: Long = 0L,
    val downloadBytesTotal: Long = 0L,
    val downloadBytesPerSecond: Long = 0L,
    val downloadSecondsLeft: Long = -1L,
    val downloadRetryAt: Long = 0L,
    val downloadOffline: Boolean = false,
    val showSplash: Boolean = true,
    // Playlist playback settings
    val playlistOrientation: String = "horizontal", // "horizontal" | "vertical"
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
    val isConfigLoaded: Boolean = false,
    // Paused from the dashboard — show the paused screen, keep the playlist.
    val paused: Boolean = false,
    val cameraMountEnabled: Boolean = false
)

// Dead-man's-switch ceiling for a video that never reaches STATE_ENDED or
// onPlayerError — see the rotation loop in restartAssetRotation(). All
// signage video content here is a locally-downloaded file, not a stream, so
// there's no legitimate reason a healthy video should still be "playing"
// this long after the loop last checked it.
private const val VIDEO_WATCHDOG_TIMEOUT_MS = 10 * 60 * 1000L // 10 minutes

class SignageViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = SignageRepository(application)

    val videoCallManager = VideoCallManager(application)

    private val _uiState = MutableStateFlow(SignageUiState())
    val uiState: StateFlow<SignageUiState> = _uiState.asStateFlow()

    private var syncJob: Job? = null
    private var heartbeatJob: Job? = null
    private var assetRotationJob: Job? = null

    // elapsedRealtime() of the last structural change to the assigned
    // playlist; see refreshPlayback().
    private var playlistChangedAt = 0L

    // elapsedRealtime() at which the splash logo reveal started playing.
    @Volatile private var splashLogoStartedAt = 0L

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

        // Pause/resume from the dashboard.
        viewModelScope.launch {
            repository.pausedFlow.collect { paused ->
                _uiState.update { it.copy(paused = paused) }
                restartAssetRotation(force = true)
            }
        }

        // What this TV reports back to the dashboard's "Check status".
        videoCallManager.statusReporter = {
            val s = _uiState.value
            org.json.JSONObject().apply {
                put("status", s.status)
                put("paused", s.paused)
                put("playing", !s.paused && s.playbackPlaylist.isNotEmpty())
                put("currentAsset", s.playbackPlaylist.getOrNull(s.currentAssetIndex)?.filename ?: "")
                put("assetsReady", s.playbackPlaylist.size)
                put("assetsTotal", s.playlist.size)
                put("downloading", s.isDownloading)
            }
        }

        // Server pushed a config change over the socket — re-sync right away
        // instead of waiting for the next scheduled poll (which now runs on a
        // much longer interval than it used to, precisely because this exists).
        viewModelScope.launch {
            videoCallManager.configChanged.collect {
                try {
                    repository.syncScreenStatus()
                } catch (e: Exception) {
                    Log.e("SignageViewModel", "Push-triggered sync failed", e)
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
                            isConfigLoaded = true,
                            cameraMountEnabled = config.cameraMountEnabled
                        )
                    }
                    // Every paired screen holds this socket open now, not just
                    // camera-mount-enabled ones — it's how the server pushes
                    // "your config changed" instantly instead of the screen
                    // waiting for its next poll. Call-signaling handlers on this
                    // same socket stay inert for non-VC screens since the server
                    // never initiates a conference on a screen without a camera.
                    if (config.screenId.isNotEmpty()) {
                        videoCallManager.start(config.serverUrl, config.screenId, config.hardwareUuid)
                    } else {
                        videoCallManager.stop()
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
                val structurallyChanged = !isPlaylistStructurallyEqual(_uiState.value.playlist, filteredAssets)
                if (structurallyChanged) {
                    playlistChangedAt = android.os.SystemClock.elapsedRealtime()
                }
                _uiState.update { it.copy(playlist = filteredAssets) }
                if (structurallyChanged) {
                    repository.startDownloadingPendingAssets()
                }
                refreshPlayback()
            }
        }

        // A download pass finishing can change what should be on screen (e.g.
        // switch from the previous playlist to whatever of the new one arrived).
        viewModelScope.launch {
            repository.downloadRunCompletedFlow.collect {
                refreshPlayback()
            }
        }

        // Collect repository download state progress
        viewModelScope.launch {
            repository.downloadStateFlow.collectLatest { downloadState ->
                _uiState.update {
                    val totalAssets = it.playlist.size

                    val progressMessage = if (downloadState.isDownloading && downloadState.totalFiles > 0) {
                        val alreadyCached = (totalAssets - downloadState.totalFiles).coerceAtLeast(0)
                        val displayCompleted = (alreadyCached + downloadState.completedFiles + 1).coerceAtMost(totalAssets)
                        val downloadedMB = String.format("%.1f", downloadState.downloadedBytes / (1024.0 * 1024.0))
                        val totalMB = if (downloadState.totalFileBytes > 0) String.format("%.1f", downloadState.totalFileBytes / (1024.0 * 1024.0)) else ""
                        val mbDetail = if (totalMB.isNotEmpty()) " — $downloadedMB MB / $totalMB MB" else if (downloadState.downloadedBytes > 0) " — $downloadedMB MB" else ""
                        "Downloading asset $displayCompleted of $totalAssets: ${downloadState.currentFileName}$mbDetail"
                    } else {
                        ""
                    }
                    
                    // Progress by data, not file count — one big video used to sit
                    // at "3 of 4" for minutes. Falls back to counts when the server
                    // didn't report file sizes.
                    val media = it.playlist.filter { a ->
                        a.mediaType.equals("image", ignoreCase = true) || a.mediaType.equals("video", ignoreCase = true)
                    }
                    val sized = media.all { a -> (a.fileSizeBytes ?: 0L) > 0L }
                    val isReady = { a: PlaylistAsset -> !a.localPath.isNullOrEmpty() && java.io.File(a.localPath).exists() }
                    val current = if (downloadState.isDownloading) media.firstOrNull { a -> a.filename == downloadState.currentFileName && !isReady(a) } else null
                    val bytesTotal = if (sized) media.sumOf { a -> a.fileSizeBytes ?: 0L } else 0L
                    val bytesDone = if (sized) {
                        media.filter { a -> isReady(a) && a !== current }.sumOf { a -> a.fileSizeBytes ?: 0L } +
                            (if (current != null) downloadState.downloadedBytes else 0L)
                    } else 0L
                    val overallProgress = when {
                        media.isEmpty() -> 0f
                        sized && bytesTotal > 0 -> (bytesDone.toFloat() / bytesTotal).coerceIn(0f, 1f)
                        else -> {
                            val readyCount = media.count(isReady)
                            ((readyCount + (if (current != null) downloadState.currentFileProgress else 0f)) / media.size).coerceIn(0f, 1f)
                        }
                    }
                    val secondsLeft = if (sized && downloadState.bytesPerSecond > 0 && bytesTotal > bytesDone) {
                        (bytesTotal - bytesDone) / downloadState.bytesPerSecond
                    } else -1L

                    it.copy(
                        isDownloading = downloadState.isDownloading,
                        downloadProgressMessage = progressMessage,
                        downloadProgressFraction = overallProgress,
                        downloadCurrentFile = if (downloadState.isDownloading) downloadState.currentFileName else "",
                        downloadCurrentBytes = downloadState.downloadedBytes,
                        downloadCurrentTotalBytes = downloadState.totalFileBytes,
                        downloadBytesDone = bytesDone,
                        downloadBytesTotal = bytesTotal,
                        downloadBytesPerSecond = downloadState.bytesPerSecond,
                        downloadSecondsLeft = secondsLeft,
                        downloadRetryAt = downloadState.nextRetryAt,
                        downloadOffline = downloadState.offline,
                        errorMessage = downloadState.errorMessage
                    )
                }
            }
        }

        // Start dynamic sync and diagnostics background services
        startSyncEngine()
        startDiagnosticsHeartbeatEngine()

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

        // Splash dismissal, timed like the phone app's BootScreen: wait for the
        // logo reveal to actually start (its layers decoded — capped so a stuck
        // decode can never trap the screen here), let it play to the end plus
        // a short beat, then additionally wait (up to a few seconds) for a
        // white-label logo to be cached so branding doesn't pop in late.
        viewModelScope.launch {
            val bootStart = android.os.SystemClock.elapsedRealtime()
            while (splashLogoStartedAt == 0L && android.os.SystemClock.elapsedRealtime() - bootStart < 2500) {
                delay(50)
            }
            val logoStart = if (splashLogoStartedAt != 0L) splashLogoStartedAt else android.os.SystemClock.elapsedRealtime()
            val revealDoneAt = logoStart + com.example.ui.components.SPLASH_LOGO_DURATION_MS + 150
            while (android.os.SystemClock.elapsedRealtime() < revealDoneAt) {
                delay(50)
            }

            val maxWaitMs = 4000L
            val startTime = System.currentTimeMillis()
            while (System.currentTimeMillis() - startTime < maxWaitMs) {
                val state = _uiState.value
                if (state.isConfigLoaded) {
                    if (!state.isWhiteLabel || !state.whiteLabelLogoPath.isNullOrEmpty()) {
                        break
                    }
                }
                delay(200)
            }
            _uiState.update { it.copy(showSplash = false) }
        }
    }

    /** Called by the splash once its logo reveal has actually started playing. */
    fun onSplashLogoStarted() {
        if (splashLogoStartedAt == 0L) {
            splashLogoStartedAt = android.os.SystemClock.elapsedRealtime()
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
                // Defaults to the responsive interval if reading config fails —
                // fail toward keeping physical displays reactive, not toward
                // silently going quiet for a minute.
                var isPairing = true
                try {
                    val config = repository.getOrCreateConfig()
                    isPairing = config.status == "pairing"
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
                // A human is actively watching the screen during setup, waiting for
                // the pairing code to activate — keep that phase fast. Once a screen
                // is actively displaying content, this is now a safety-net poll (the
                // server pushes real changes over the socket the instant they
                // happen), so a fleet of these can run on a much longer, jittered
                // interval without anyone noticing slower reactions to a change that
                // was never going to come through polling anyway.
                if (isPairing) {
                    delay(7500)
                } else {
                    delay(60000L + Random.nextLong(0, 15000))
                }
            }
        }
    }

    private fun startDiagnosticsHeartbeatEngine() {
        heartbeatJob?.cancel()
        heartbeatJob = viewModelScope.launch {
            while (isActive) {
                try {
                    val state = _uiState.value
                    if (state.screenId.isNotEmpty() && isPlayingStatus(state.status)) {
                        val currentAsset = state.playbackPlaylist.getOrNull(state.currentAssetIndex)
                        repository.sendDiagnosticsHeartbeat(currentAsset?.filename)
                    }
                } catch (e: Exception) {
                    Log.e("SignageViewModel", "Heartbeat broadcast failed", e)
                }
                // Server treats a screen as offline after 180s with no heartbeat
                // (Redis presence TTL) — 45-60s jittered leaves a comfortable 3x
                // margin while cutting fleet-wide heartbeat volume to a third of
                // the old fixed 20s interval.
                delay(45000L + Random.nextLong(0, 15000))
            }
        }
    }

    private fun isAssetReady(asset: PlaylistAsset): Boolean =
        !asset.localPath.isNullOrEmpty() && java.io.File(asset.localPath).exists()

    /**
     * Decides what plays. Previously nothing played until EVERY file in the
     * assigned playlist was downloaded — one missing/broken file kept the
     * screen on "Downloading media" forever, and assigning a new playlist
     * blanked the screen until all of it arrived.
     */
    private fun refreshPlayback() {
        val state = _uiState.value
        val assigned = state.playlist
        val ready = assigned.filter { isAssetReady(it) }
        val current = state.playbackPlaylist
        val downloadPassDone = repository.downloadRunCompletedFlow.value >= playlistChangedAt

        val next = when {
            assigned.isEmpty() -> emptyList()
            // Everything is here: play the assigned playlist.
            ready.size == assigned.size -> assigned
            // New playlist still downloading: keep showing what was already playing.
            !downloadPassDone && current.isNotEmpty() && current.all { isAssetReady(it) } -> current
            // Otherwise play whatever has arrived (empty -> download screen).
            else -> ready
        }

        val changed = !isPlaylistStructurallyEqual(current, next)
        _uiState.update {
            it.copy(
                playbackPlaylist = next,
                currentAssetIndex = if (changed) 0 else it.currentAssetIndex.coerceIn(0, (next.size - 1).coerceAtLeast(0))
            )
        }
        restartAssetRotation(force = changed)
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
        val playlist = _uiState.value.playbackPlaylist
        if (playlist.isEmpty() || _uiState.value.paused || !isPlayingStatus(_uiState.value.status)) {
            return
        }

        assetRotationJob = viewModelScope.launch {
            while (isActive) {
                // Always read live state to avoid stale snapshot
                val state = _uiState.value
                val livePlaylist = state.playbackPlaylist
                val currentIndex = state.currentAssetIndex

                if (livePlaylist.isEmpty()) break
                if (!isPlayingStatus(state.status)) break

                val currentAsset = livePlaylist.getOrNull(currentIndex) ?: break

                if (currentAsset.mediaType.equals("video", ignoreCase = true)) {
                    // Normal advancement for video comes from the player
                    // listener calling advanceToNextAsset() on STATE_ENDED /
                    // onPlayerError (see PlaybackLoopScreen.kt) — this
                    // ViewModel has no direct handle on the ExoPlayer
                    // instance, so it can't observe playback health itself.
                    // This is strictly a dead-man's switch for a decoder
                    // that hangs mid-playback with neither callback ever
                    // firing. Previously this just delayed and looped back
                    // around with zero corrective action, so a genuine
                    // silent hang stalled the screen forever in dead 1-hour
                    // naps instead of ever actually recovering. All content
                    // here is a locally-downloaded file (not streamed), so
                    // there's no legitimate reason for a healthy video to
                    // run this long without reaching STATE_ENDED — after the
                    // timeout, force the same advancement a normal
                    // completion would have triggered.
                    delay(VIDEO_WATCHDOG_TIMEOUT_MS)
                    _uiState.update { s ->
                        val livePl = s.playbackPlaylist
                        // Only force it if we're still stuck on the exact
                        // asset we started waiting on — if the player's own
                        // callback already advanced (or a sync/restart
                        // changed things) while we were sleeping, don't
                        // double-advance on top of that.
                        if (livePl.isEmpty() || s.currentAssetIndex != currentIndex) return@update s
                        val nextIndex = (s.currentAssetIndex + 1) % livePl.size
                        s.copy(currentAssetIndex = nextIndex)
                    }
                    continue
                }

                val durationMs = (currentAsset.duration * 1000L).coerceAtLeast(3000L) // Min 3 seconds
                delay(durationMs)

                // Advance to next, wrapping around (always loop)
                _uiState.update { s ->
                    val livePl = s.playbackPlaylist
                    if (livePl.isEmpty()) return@update s
                    val nextIndex = (s.currentAssetIndex + 1) % livePl.size
                    s.copy(currentAssetIndex = nextIndex)
                }
            }
        }
    }

    fun advanceToNextAsset() {
        val playlist = _uiState.value.playbackPlaylist
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
        // notifyServer = false: this fires on every process teardown, including a
        // routine app quit mid-call — telling the server "video:leave-conference"
        // here would delete its active-conference record and break the
        // mid-conference replay this screen relies on to rejoin after reopening.
        videoCallManager.stop(notifyServer = false)

        kotlinx.coroutines.runBlocking {
            try {
                repository.sendOfflineNotification("App was closed / process terminated.")
            } catch (e: Exception) {
                Log.e("SignageViewModel", "Failed to send offline notification on clear", e)
            }
        }
    }
}
