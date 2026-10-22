package com.example.util

import android.content.Context
import android.os.Build
import android.util.Log


private const val EXPERIMENT_ENABLED = true
private const val DIAGONAL_THRESHOLD_INCHES = 55
private val MODEL_SIZE_REGEX = Regex("^(\\d{2,3})[A-Za-z]")

fun screenInchesFromModel(model: String = Build.MODEL): Int? =
    MODEL_SIZE_REGEX.find(model.trim())?.groupValues?.get(1)?.toIntOrNull()?.takeIf { it in 20..120 }

fun isAboveExperimentThreshold(context: Context): Boolean {
    if (!EXPERIMENT_ENABLED) return false
    val inches = screenInchesFromModel()
    Log.i(TAG, "model=${Build.MODEL} parsedInches=$inches")
    return inches != null && inches > DIAGONAL_THRESHOLD_INCHES
}

private const val TAG = "ScreenSizeExperiment"
