package com.example.util

import android.content.Context
import android.os.Build
import android.util.Log

/**
 * TEMPORARY EXPERIMENT — requested to trial a "looks broken" render on large
 * screens. To undo: delete this file and its call sites in
 * PlaybackLoopScreen.kt (search for isAboveExperimentThreshold).
 *
 * TV boxes report a fake DPI (e.g. a 55" 1080p panel says 240 dpi => "9 in"),
 * so size can't be measured. Instead it is read from the model name, where
 * signage models lead with the inches (Philips "55BDL2050Q-N" = 55"). A model
 * with no leading size number never triggers the experiment.
 */
private const val EXPERIMENT_ENABLED = true
private const val DIAGONAL_THRESHOLD_INCHES = 55
private val MODEL_SIZE_REGEX = Regex("^(\\d{2,3})[A-Za-z]")

/** Inches parsed from the start of Build.MODEL, or null if it doesn't lead with a plausible size. */
fun screenInchesFromModel(model: String = Build.MODEL): Int? =
    MODEL_SIZE_REGEX.find(model.trim())?.groupValues?.get(1)?.toIntOrNull()?.takeIf { it in 20..120 }

fun isAboveExperimentThreshold(context: Context): Boolean {
    if (!EXPERIMENT_ENABLED) return false
    val inches = screenInchesFromModel()
    Log.i(TAG, "model=${Build.MODEL} parsedInches=$inches")
    return inches != null && inches > DIAGONAL_THRESHOLD_INCHES
}

private const val TAG = "ScreenSizeExperiment"
