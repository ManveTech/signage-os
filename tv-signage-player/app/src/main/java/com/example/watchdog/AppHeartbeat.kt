package com.example.watchdog

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock

/**
 * Tracks whether the signage app is alive and in the foreground, backed by
 * elapsedRealtime (not wall-clock) so it stays correct across NTP/timezone
 * changes and reboots. WatchdogReceiver compares against this to decide
 * whether to force a relaunch.
 */
object AppHeartbeat {
    private const val PREFS_NAME = "watchdog_prefs"
    private const val KEY_LAST_BEAT = "last_heartbeat_elapsed"
    const val IDLE_THRESHOLD_MS = 2 * 60 * 1000L
    private const val CHECK_INTERVAL_MS = 30 * 1000L

    fun touch(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_BEAT, SystemClock.elapsedRealtime())
            .apply()
    }

    fun millisSinceLastHeartbeat(context: Context): Long {
        val last = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong(KEY_LAST_BEAT, SystemClock.elapsedRealtime())
        return SystemClock.elapsedRealtime() - last
    }

    /** Schedules the next watchdog check. Safe to call even if the app process is about to die. */
    fun scheduleNextCheck(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, WatchdogReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val triggerAt = SystemClock.elapsedRealtime() + CHECK_INTERVAL_MS
        // Not using setExactAndAllowWhileIdle: exact alarms need a separate
        // user-granted permission on Android 12+, and a watchdog firing a few
        // seconds late is harmless.
        alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
    }
}
