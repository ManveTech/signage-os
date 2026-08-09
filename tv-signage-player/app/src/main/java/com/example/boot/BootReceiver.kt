package com.example.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.MainActivity
import com.example.watchdog.AppHeartbeat

/**
 * Launches the signage app as soon as the TV box finishes booting, and kicks
 * off the watchdog alarm loop so a relaunch check runs even before the
 * activity itself has a chance to (re)start it.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(launchIntent)
            AppHeartbeat.scheduleNextCheck(context)
        }
    }
}
