package com.example.util

import android.content.Context
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowManager
import kotlin.math.sqrt

/**
 * TEMPORARY EXPERIMENT — requested to trial a "looks broken" render on large
 * screens. To undo: delete this file and its one call site in
 * PlaybackLoopScreen.kt (search for isAboveExperimentThreshold).
 *
 * Estimates physical screen diagonal in inches from reported DPI. Caveat:
 * many Android TV boxes report a generic/normalized DPI rather than their
 * true physical density, so this may not reliably distinguish actual screen
 * sizes across all hardware — verify against the real TVs being tested
 * rather than trusting this in the abstract.
 */
private const val EXPERIMENT_ENABLED = true
private const val DIAGONAL_THRESHOLD_INCHES = 55.0

fun isAboveExperimentThreshold(context: Context): Boolean {
    if (!EXPERIMENT_ENABLED) return false
    return try {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val widthPx: Int
        val heightPx: Int
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = wm.currentWindowMetrics.bounds
            widthPx = bounds.width()
            heightPx = bounds.height()
        } else {
            val dm = DisplayMetrics()
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealMetrics(dm)
            widthPx = dm.widthPixels
            heightPx = dm.heightPixels
        }
        val density = context.resources.displayMetrics
        val widthInches = widthPx / density.xdpi
        val heightInches = heightPx / density.ydpi
        val diagonal = sqrt((widthInches * widthInches + heightInches * heightInches).toDouble())
        diagonal > DIAGONAL_THRESHOLD_INCHES
    } catch (e: Exception) {
        false
    }
}
