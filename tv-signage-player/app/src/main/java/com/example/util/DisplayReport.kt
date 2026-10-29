package com.example.util

import android.content.Context
import android.hardware.display.DisplayManager
import android.util.DisplayMetrics
import android.view.Display
import android.view.Surface

/**
 * The picture as Android draws it right now: its size in pixels and the
 * rotation the system applies. A display rotated in its own settings (e.g. a
 * Philips monitor's PBS "rotate 90°") turns Android itself to portrait, so the
 * size comes back taller than wide. The dashboard uses this to know there is
 * nothing for the app to rotate.
 */
object DisplayReport {
    data class Info(val width: Int, val height: Int, val rotation: Int)

    fun read(context: Context): Info? = try {
        val display = context.getSystemService(DisplayManager::class.java)?.getDisplay(Display.DEFAULT_DISPLAY)
        if (display == null) null else {
            val metrics = DisplayMetrics()
            @Suppress("DEPRECATION")
            display.getRealMetrics(metrics)
            val rotation = when (display.rotation) {
                Surface.ROTATION_90 -> 90
                Surface.ROTATION_180 -> 180
                Surface.ROTATION_270 -> 270
                else -> 0
            }
            if (metrics.widthPixels > 0 && metrics.heightPixels > 0) Info(metrics.widthPixels, metrics.heightPixels, rotation) else null
        }
    } catch (_: Exception) {
        null
    }
}
