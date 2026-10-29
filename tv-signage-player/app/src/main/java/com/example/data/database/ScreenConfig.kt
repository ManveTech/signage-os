package com.example.data.database

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "screen_config")
data class ScreenConfig(
    @PrimaryKey val id: Int = 1,
    val hardwareUuid: String,
    val screenId: String = "",
    val pairingCode: String = "",
    val status: String = "pairing",
    val screenName: String = "Digital Signage Screen",
    val serverUrl: String = com.example.AppConfig.SERVER_URL,
    val pocketbaseUrl: String = com.example.AppConfig.POCKETBASE_URL,
    val lastSyncedAt: Long = 0L,
    val playlistOrientation: String = "horizontal", // "horizontal" | "vertical"
    // Shown upside down (display mounted the other way up).
    @ColumnInfo(defaultValue = "0") val playlistFlipped: Boolean = false,
    // How this screen is mounted, set on the screen in the dashboard: "landscape"
    // | "portrait", and upside down. Null from servers that only had it on the
    // playlist — the playlist's values are used then.
    val screenOrientation: String? = null,
    val screenFlipped: Boolean? = null,
    val playlistShuffle: Boolean = false,
    val playlistLoop: Boolean = true,
    val playlistVolume: Int = 80,
    val playlistTransition: String = "fade",
    val screenVolume: Int = 100,
    val widgetType: String? = null,
    val widgetPlacement: String? = null,
    val widgetLink: String? = null,
    val isWhiteLabel: Boolean = false,
    val whiteLabelLogoUrl: String? = null,
    val whiteLabelLogoPath: String? = null,
    val whiteLabelName: String? = null,
    // Only screens with a camera mounted (and thus licensed for video conferencing
    // on the assigned user's plan) connect the realtime call signaling channel.
    val cameraMountEnabled: Boolean = false
)
