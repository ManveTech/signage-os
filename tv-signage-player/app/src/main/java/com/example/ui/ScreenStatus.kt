package com.example.ui

/**
 * Whether a paired screen should be playing content (and heartbeating).
 *
 * Several places used to whitelist "active" / "online" / "offline". Any
 * other status the server can set — "warning", for example — then stopped
 * playback and heartbeats, and the screen showed the *pairing* screen even
 * though it was paired.
 */
fun isPlayingStatus(status: String?): Boolean =
    !status.isNullOrEmpty() && status != "pairing" && status != "unlinked" && status != "suspended"
