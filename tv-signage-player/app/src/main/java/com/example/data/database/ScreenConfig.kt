package com.example.data.database

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
    val whiteLabelName: String? = null
)
