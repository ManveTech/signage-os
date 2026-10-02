package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.SignageUiState

/**
 * Shown while playback is paused from the dashboard. The playlist and its
 * downloaded files are kept, so resuming continues immediately.
 */
@Composable
fun PausedScreen(uiState: SignageUiState) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF070709))
            .padding(48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        SignageLogo(uiState = uiState, size = 96.dp, cornerRadius = 16.dp)
        Spacer(modifier = Modifier.height(28.dp))
        Text(
            text = "PLAYBACK PAUSED",
            color = Color(0xFF9AA4B8),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 2.sp
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = uiState.screenName,
            color = Color(0xFF5A6478),
            fontSize = 12.sp
        )
    }
}
