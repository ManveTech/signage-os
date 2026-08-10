package com.example.util

import android.content.Context
import android.util.Log
import com.example.data.database.AppDatabase
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class CrashReportingHandler(
    private val context: Context,
    private val defaultHandler: Thread.UncaughtExceptionHandler?
) : Thread.UncaughtExceptionHandler {
    companion object {
        private val sharedClient by lazy { OkHttpClient() }

        /**
         * Posts an event to screen_logs synchronously (blocking). Shared by crash
         * reporting and by Breadcrumbs' abnormal-exit detection, both of which need
         * this to complete before the process is torn down or before racing ahead.
         */
        fun report(context: Context, event: String, detail: String, type: String = "error") {
            try {
                val db = AppDatabase.getDatabase(context)
                val config = runBlocking { db.screenConfigDao().getConfig() } ?: return
                if (config.screenId.isEmpty()) return

                var redactedDetail = detail
                if (config.pocketbaseUrl.isNotEmpty()) {
                    redactedDetail = redactedDetail.replace(config.pocketbaseUrl, "[POCKETBASE_URL]")
                }
                if (config.serverUrl.isNotEmpty()) {
                    redactedDetail = redactedDetail.replace(config.serverUrl, "[SERVER_URL]")
                }

                val fields = mapOf(
                    "screenId" to config.screenId,
                    "screenName" to config.screenName,
                    "event" to event,
                    "type" to type,
                    "detail" to redactedDetail
                )
                val mapType = Types.newParameterizedType(Map::class.java, String::class.java, String::class.java)
                val json = Moshi.Builder()
                    .addLast(KotlinJsonAdapterFactory())
                    .build()
                    .adapter<Map<String, String>>(mapType)
                    .toJson(fields)

                val mediaType = "application/json".toMediaTypeOrNull()
                val body = json.toRequestBody(mediaType)
                val request = Request.Builder()
                    .url("${config.serverUrl}/api/v1/screen_logs")
                    .post(body)
                    .build()

                val response = sharedClient.newCall(request).execute()
                response.close()
            } catch (e: Exception) {
                Log.e("CrashReportingHandler", "Failed to log event to server", e)
            }
        }
    }

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        val errorMsg = "Crash: ${throwable.message ?: throwable.javaClass.simpleName}\n" +
                throwable.stackTraceToString()
        report(context, "Application Crash", errorMsg)
        defaultHandler?.uncaughtException(thread, throwable)
    }
}
