package com.example.util

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Sleep mode on the TV: the times this screen goes dark and silent (its own
 * or its group's, worked out by the server) plus any "Sleep now / Wake now"
 * from the dashboard. The TV decides by itself every few seconds, so it
 * sleeps and wakes on time even without a connection. Same rules as
 * src/lib/sleepSchedule.ts on the server.
 */
@JsonClass(generateAdapter = true)
data class SleepRule(
    /** 0 = Sunday … 6 = Saturday — the day the sleep starts. */
    val days: List<Int> = emptyList(),
    val from: String = "",
    val to: String = ""
)

@JsonClass(generateAdapter = true)
data class SleepOverride(
    /** "sleep" or "wake". */
    val state: String = "",
    /** Until when (epoch ms); null = until changed from the dashboard. */
    val untilMs: Long? = null
)

@JsonClass(generateAdapter = true)
data class SleepConfig(
    val rules: List<SleepRule>? = null,
    val utcOffsetMinutes: Int? = null,
    @Json(name = "override") val manual: SleepOverride? = null
)

object SleepSchedule {
    private fun minutesOf(hhmm: String): Int {
        val parts = hhmm.trim().split(":")
        if (parts.size != 2) return -1
        val h = parts[0].toIntOrNull() ?: return -1
        val m = parts[1].toIntOrNull() ?: return -1
        return if (h in 0..23 && m in 0..59) h * 60 + m else -1
    }

    fun asleepByRules(rules: List<SleepRule>, nowMs: Long, utcOffsetMinutes: Int): Boolean {
        if (rules.isEmpty()) return false
        val localMinutes = Math.floorDiv(nowMs, 60_000L) + utcOffsetMinutes
        val dayIndex = Math.floorDiv(localMinutes, 1440L)
        val minute = Math.floorMod(localMinutes, 1440L).toInt()
        // 1 Jan 1970 was a Thursday (4).
        val day = Math.floorMod(dayIndex + 4, 7L).toInt()
        val yesterday = (day + 6) % 7
        return rules.any { r ->
            val from = minutesOf(r.from)
            val to = minutesOf(r.to)
            when {
                from < 0 || to < 0 -> false
                from < to -> day in r.days && minute >= from && minute < to
                // Overnight (or all day when from == to).
                else -> (day in r.days && minute >= from) || (yesterday in r.days && minute < to)
            }
        }
    }

    fun isAsleep(config: SleepConfig?, nowMs: Long = System.currentTimeMillis()): Boolean {
        if (config == null) return false
        val manual = config.manual
        if (manual != null && (manual.state == "sleep" || manual.state == "wake")) {
            val until = manual.untilMs
            if (until == null || nowMs < until) return manual.state == "sleep"
        }
        return asleepByRules(config.rules ?: emptyList(), nowMs, config.utcOffsetMinutes ?: 330)
    }
}
