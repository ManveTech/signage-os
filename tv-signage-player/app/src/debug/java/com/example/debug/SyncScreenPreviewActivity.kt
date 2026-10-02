package com.example.debug

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.example.data.database.PlaylistAsset
import com.example.ui.SignageUiState
import com.example.ui.components.DownloadProgressScreen
import com.example.watchdog.AppHeartbeat

/** Debug-only preview of DownloadProgressScreen with sample data. */
class SyncScreenPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Keeps WatchdogReceiver from yanking MainActivity over this preview.
        AppHeartbeat.touch(this)
        val paused = intent.getStringExtra("state") == "paused"
        // Any file that always exists stands in for "already downloaded".
        val onDisk = "/system/build.prop"
        val playlist = listOf(
            PlaylistAsset("1", "", "diwali-offer-banner.jpg", onDisk, "image", sortOrder = 0),
            PlaylistAsset("2", "", "store-walkthrough-4k.mp4", onDisk, "video", sortOrder = 1),
            PlaylistAsset("3", "", "new-arrivals-reel.mp4", null, "video", sortOrder = 2),
            PlaylistAsset("4", "", "brand-intro", null, "youtube", sortOrder = 3),
            PlaylistAsset("5", "", "menu-board-evening.png", null, "image", sortOrder = 4),
            PlaylistAsset("6", "", "loyalty-program-explainer.mp4", null, "video", sortOrder = 5),
            PlaylistAsset("7", "", "weekend-sale-portrait.jpg", null, "image", sortOrder = 6),
        )
        val state = SignageUiState(
            status = "active",
            playlist = playlist,
            showSplash = false,
            isDownloading = !paused,
            downloadProgressFraction = if (paused) 3f / 7f else 0.52f,
            downloadCurrentFile = if (paused) "" else "new-arrivals-reel.mp4",
            downloadCurrentBytes = 48_600_000L,
            downloadCurrentTotalBytes = 126_000_000L,
            errorMessage = if (paused) "Network timeout while downloading new-arrivals-reel.mp4" else null,
        )
        setContent { DownloadProgressScreen(uiState = state, onTriggerDownloads = {}, onOpenAdmin = {}) }
    }
}
