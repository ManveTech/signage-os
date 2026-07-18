package com.example.data.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "playlist_assets")
data class PlaylistAsset(
    @PrimaryKey val id: String,
    val url: String,
    val filename: String,
    val localPath: String? = null,
    val mediaType: String, // "image" or "video"
    val duration: Int = 10, // Default duration in seconds
    val sortOrder: Int = 0,
    val checksum: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    val fileSize: String? = null,
    val fileSizeBytes: Long? = null,
    val mimeType: String? = null,
    val youtubeVideoId: String? = null,
    val objectFit: String? = "cover",
    val scalePercent: Int? = 100
)
