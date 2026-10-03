package com.example

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.example.data.database.PlaylistAsset
import com.example.ui.SignageUiState
import com.example.ui.components.DownloadProgressScreen
import com.example.ui.components.friendlyMediaName
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w960dp-h540dp-land-xhdpi", sdk = [34])
class DownloadScreenTest {
    @get:Rule val compose = createComposeRule()

    private val assets = listOf(
        PlaylistAsset(id = "a", url = "u1", filename = "diwali_banner_k2j9x0q1zz.png", localPath = "/nonexistent", mediaType = "image", duration = 10, sortOrder = 0, fileSizeBytes = 2_400_000),
        PlaylistAsset(id = "b", url = "u2", filename = "store-walkthrough_ab12cd34ef.mp4", localPath = null, mediaType = "video", duration = 30, sortOrder = 1, fileSizeBytes = 184_000_000),
        PlaylistAsset(id = "c", url = "u3", filename = "Opening_hours.jpg", localPath = null, mediaType = "image", duration = 10, sortOrder = 2, fileSizeBytes = 800_000),
    )

    private fun state(downloading: Boolean, offline: Boolean = false) = SignageUiState(
        status = "online",
        screenName = "Lobby TV",
        playlist = assets,
        isDownloading = downloading,
        downloadCurrentFile = if (downloading) "store-walkthrough_ab12cd34ef.mp4" else "",
        downloadCurrentBytes = 61_000_000,
        downloadCurrentTotalBytes = 184_000_000,
        downloadProgressFraction = 0.34f,
        downloadBytesDone = 63_400_000,
        downloadBytesTotal = 187_200_000,
        downloadBytesPerSecond = 2_600_000,
        downloadSecondsLeft = 48,
        downloadOffline = offline,
        errorMessage = if (offline) "This display can't reach the internet. Check its network connection." else null,
        isConfigLoaded = true,
        showSplash = false
    )

    @Test fun friendlyNames() {
        assertEquals("Diwali banner", friendlyMediaName("diwali_banner_k2j9x0q1zz.png"))
        assertEquals("Store walkthrough", friendlyMediaName("store-walkthrough_ab12cd34ef.mp4"))
        assertEquals("Opening hours", friendlyMediaName("media/2026/10/x/Opening_hours.jpg"))
        assertEquals("Summer collection", friendlyMediaName("summer_collection.jpg"))
    }

    @Test fun downloading() {
        compose.setContent { DownloadProgressScreen(uiState = state(true), onTriggerDownloads = {}, onOpenAdmin = {}) }
        compose.onRoot().captureRoboImage("build/download_screen.png")
    }

    @Test fun offline() {
        compose.setContent { DownloadProgressScreen(uiState = state(false, offline = true), onTriggerDownloads = {}, onOpenAdmin = {}) }
        compose.onRoot().captureRoboImage("build/download_screen_offline.png")
    }
}
