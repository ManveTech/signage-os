package com.example.data.network

import android.content.Context
import android.util.Log
import com.example.data.database.AppDatabase
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

class ErrorLoggingInterceptor(private val context: Context) : Interceptor {
    companion object {
        private val sharedClient by lazy { OkHttpClient() }
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val path = request.url.encodedPath
        if (path.contains("/screen_logs") || path.contains("/offline") || path.contains("/realtime")) {
            return chain.proceed(request)
        }

        try {
            val response = chain.proceed(request)
            if (!response.isSuccessful) {
                val errorMsg = "HTTP Error: ${response.code} ${response.message}"
                logRequestFailure(request, errorMsg)
            }
            return response
        } catch (e: Exception) {
            val errorMsg = "Network Error: ${e.message ?: e.javaClass.simpleName}"
            logRequestFailure(request, errorMsg)
            throw e
        }
    }

    private fun logRequestFailure(request: Request, errorMsg: String) {
        val db = AppDatabase.getDatabase(context)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val config = db.screenConfigDao().getConfig() ?: return@launch
                if (config.screenId.isEmpty()) return@launch

                val client = sharedClient
                val fields = mapOf(
                    "screenId" to config.screenId,
                    "screenName" to config.screenName,
                    "event" to redactText("Request Failure: ${request.method} ${request.url}", config.pocketbaseUrl, config.serverUrl),
                    "type" to "error",
                    "detail" to redactText(errorMsg, config.pocketbaseUrl, config.serverUrl)
                )
                val mapType = Types.newParameterizedType(Map::class.java, String::class.java, String::class.java)
                val json = Moshi.Builder()
                    .addLast(KotlinJsonAdapterFactory())
                    .build()
                    .adapter<Map<String, String>>(mapType)
                    .toJson(fields)

                val body = json.toRequestBody("application/json".toMediaTypeOrNull())
                val logRequest = Request.Builder()
                    .url("${config.serverUrl}/api/v1/screen_logs")
                    .post(body)
                    .build()

                client.newCall(logRequest).execute().use { response ->
                    if (!response.isSuccessful) {
                        Log.e("ErrorLoggingInterceptor", "Failed to send request failure log: ${response.code}")
                    }
                }
            } catch (e: Exception) {
                Log.e("ErrorLoggingInterceptor", "Error logging request failure", e)
            }
        }
    }
}

fun redactText(text: String, pocketbaseUrl: String, serverUrl: String): String {
    var result = text
    if (pocketbaseUrl.isNotEmpty()) {
        result = result.replace(pocketbaseUrl, "[POCKETBASE_URL]")
    }
    if (serverUrl.isNotEmpty()) {
        result = result.replace(serverUrl, "[SERVER_URL]")
    }
    return result
}
