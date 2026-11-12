package com.example.util

import android.content.Context
import android.util.Log
import com.example.data.database.AppDatabase
import io.sentry.Sentry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Identifies this TV in crash reports.
 *
 * Sentry itself starts from its own ContentProvider, before Application
 * .onCreate and long before any of this runs — that is the point of it, and
 * why it catches startup crashes the old CrashReportingHandler could not. By
 * the time a report is sent, though, it is just "some device": useful for
 * spotting that forty screens hit the same fault, useless for working out
 * which screen to go and look at.
 *
 * So once the screen's own config has loaded, the screen id and name are
 * attached as tags. Reports from before that — a crash during startup — still
 * arrive, just without the tags.
 *
 * Deliberately not attached: the owner's email, the server URLs, or anything
 * else identifying the customer. A screen id is enough to find the TV in the
 * dashboard, and it means nothing to anyone else.
 *
 * Does nothing when no DSN is configured; Sentry is disabled and every call
 * here is a no-op.
 */
object ErrorReporting {

    /** True when a DSN was configured at build time and the SDK actually started. */
    val enabled: Boolean get() = Sentry.isEnabled()

    /**
     * Reads the stored screen config off the main thread and tags this
     * device's reports with it. Safe to call before the TV is paired — it
     * simply tags nothing until there is something to tag.
     */
    fun identify(context: Context) {
        if (!Sentry.isEnabled()) return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val config = AppDatabase.getDatabase(context).screenConfigDao().getConfig() ?: return@launch
                if (config.screenId.isNotEmpty()) {
                    Sentry.setTag("screenId", config.screenId)
                }
                if (config.hardwareUuid.isNotEmpty()) {
                    Sentry.setTag("hardwareUuid", config.hardwareUuid)
                }
            } catch (e: Exception) {
                Log.w("ErrorReporting", "Could not tag crash reports with the screen id", e)
            }
        }
    }

    /**
     * Records a breadcrumb — a step along the way, shown alongside whatever
     * crashes next. Mirrors Breadcrumbs.mark(), which persists the call-setup
     * stage across a hard kill; this is the in-memory trail for a report.
     */
    fun trail(message: String, category: String = "app") {
        if (!Sentry.isEnabled()) return
        Sentry.addBreadcrumb(message, category)
    }

    /** Report something caught and handled that still shouldn't be happening. */
    fun report(throwable: Throwable) {
        if (!Sentry.isEnabled()) return
        Sentry.captureException(throwable)
    }
}
