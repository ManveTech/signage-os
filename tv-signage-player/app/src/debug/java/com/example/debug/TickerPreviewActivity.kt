package com.example.debug

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.example.ui.components.RssTickerWidget
import com.example.watchdog.AppHeartbeat

/** Debug-only: the ticker widget with a short headline (the case that used to sit still). */
class TickerPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AppHeartbeat.touch(this)
        setContent {
            Box(Modifier.fillMaxSize().background(Color(0xFF1E3A8A)), contentAlignment = Alignment.BottomCenter) {
                RssTickerWidget(tickerText = """{"label":"NEWS","items":["Weekend sale — 30% off"]}""")
            }
        }
    }
}
