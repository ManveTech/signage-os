package com.example.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
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

    // Replaces the whole asset list atomically. The repository previously
    // called clearAllAssets() then insertAssets() as two separate
    // statements — Room's InvalidationTracker can dispatch a Flow update in
    // the gap between them, so getAllAssetsFlow() could briefly emit an
    // empty list mid-sync while a screen was actively playing, which the
    // ViewModel treats as a structural playlist change (resets to index 0,
    // tears down and rebuilds the player). Wrapping both statements in one
    // @Transaction makes them a single atomic unit from any observer's
    // point of view, so no intermediate empty state is ever visible.
    @Transaction
    suspend fun replaceAllAssets(assets: List<PlaylistAsset>) {
        clearAllAssets()
        insertAssets(assets)
    }
}

@Database(entities = [ScreenConfig::class, PlaylistAsset::class], version = 11, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun screenConfigDao(): ScreenConfigDao
    abstract fun playlistAssetDao(): PlaylistAssetDao

    companion object {
        val MIGRATION_10_11 = object : androidx.room.migration.Migration(10, 11) {
            override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE screen_config ADD COLUMN playlistFlipped INTEGER NOT NULL DEFAULT 0")
            }
        }

        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "signage_player_db"
                )
                // Keep the pairing when only a column is added (a destructive
                // migration would unpair every TV on update).
                .addMigrations(MIGRATION_10_11)
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
