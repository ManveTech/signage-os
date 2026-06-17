package com.example.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Dao
interface ScreenConfigDao {
    @Query("SELECT * FROM screen_config WHERE id = 1 LIMIT 1")
    fun getConfigFlow(): Flow<ScreenConfig?>

    @Query("SELECT * FROM screen_config WHERE id = 1 LIMIT 1")
    suspend fun getConfig(): ScreenConfig?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveConfig(config: ScreenConfig)

    @Query("UPDATE screen_config SET status = :status WHERE id = 1")
    suspend fun updateStatus(status: String)

    @Query("UPDATE screen_config SET screenId = :screenId, pairingCode = :pairingCode, status = :status WHERE id = 1")
    suspend fun updatePairingInfo(screenId: String, pairingCode: String, status: String)
}

@Dao
interface PlaylistAssetDao {
    @Query("SELECT * FROM playlist_assets ORDER BY sortOrder ASC")
    fun getAllAssetsFlow(): Flow<List<PlaylistAsset>>

    @Query("SELECT * FROM playlist_assets ORDER BY sortOrder ASC")
    suspend fun getAllAssets(): List<PlaylistAsset>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAssets(assets: List<PlaylistAsset>)

    @Query("UPDATE playlist_assets SET localPath = :localPath WHERE id = :id")
    suspend fun updateLocalPath(id: String, localPath: String)

    @Query("DELETE FROM playlist_assets WHERE id = :id")
    suspend fun deleteAsset(id: String)

    @Query("DELETE FROM playlist_assets")
    suspend fun clearAllAssets()
}

@Database(entities = [ScreenConfig::class, PlaylistAsset::class], version = 8, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun screenConfigDao(): ScreenConfigDao
    abstract fun playlistAssetDao(): PlaylistAssetDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "signage_player_db"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
