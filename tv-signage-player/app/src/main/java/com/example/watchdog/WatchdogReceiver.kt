package com.example.watchdog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.MainActivity

/**
 * Fires every ~30s via AlarmManager, independent of whether the app process is
 * still alive. If the signage app hasn't reported a heartbeat in over
 * [AppHeartbeat.IDLE_THRESHOLD_MS] (backgrounded, crashed, or killed by the
 * OS), force it back to the front — a TV playing signage should never be
 * sitting idle on the launcher or a dead process.
 */
class WatchdogReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (AppHeartbeat.millisSinceLastHeartbeat(context) > AppHeartbeat.IDLE_THRESHOLD_MS) {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            context.startActivity(launchIntent)
        }
        AppHeartbeat.scheduleNextCheck(context)
    }
}
