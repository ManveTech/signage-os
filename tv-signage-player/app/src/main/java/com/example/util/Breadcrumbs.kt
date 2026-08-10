package com.example.util

import android.content.Context

/**
 * Tracks the last known stage the call pipeline reached, persisted synchronously
 * so it survives a hard process kill (native crash, OOM kill) that never gives the
 * JVM a chance to run CrashReportingHandler. On the next cold start, if the last
 * stage recorded isn't one of [terminalStages], the process almost certainly died
 * mid-stage last time — useful on devices where logcat/ADB isn't reachable.
 */
object Breadcrumbs {
    private const val PREFS_NAME = "breadcrumb_prefs"
    private const val KEY_STAGE = "last_stage"
    private const val KEY_TIME = "last_stage_time"

    private val terminalStages = setOf("call-ended-clean")

    fun mark(context: Context, stage: String) {
        // commit(), not apply() — this write must be durable before any crash
        // that might happen immediately after this call returns.
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_STAGE, stage)
            .putLong(KEY_TIME, System.currentTimeMillis())
            .commit()
    }

    /** Stage name + how many ms ago it was marked, or null if the last exit looked clean. */
    fun lastAbnormalExit(context: Context): Pair<String, Long>? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val stage = prefs.getString(KEY_STAGE, null) ?: return null
        if (stage in terminalStages) return null
        val time = prefs.getLong(KEY_TIME, 0L)
        return stage to (System.currentTimeMillis() - time)
    }
}
