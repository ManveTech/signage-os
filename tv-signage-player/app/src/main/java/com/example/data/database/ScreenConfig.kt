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
    val serverUrl: String = "http://10.0.2.2:5000",
    val pocketbaseUrl: String = "http://10.0.2.2:8090",
    val lastSyncedAt: Long = 0L,
    val playlistOrientation: String = "horizontal", // "horizontal" | "vertical"
    val playlistShuffle: Boolean = false,
    val playlistLoop: Boolean = true,
    val playlistVolume: Int = 80
)
