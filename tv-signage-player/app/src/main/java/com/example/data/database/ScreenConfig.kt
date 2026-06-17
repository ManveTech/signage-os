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
    val serverUrl: String = "http://10.49.140.102:5000",
    val pocketbaseUrl: String = "https://demo.manve.co",
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
