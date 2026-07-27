package com.example.ui.components

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.SignageUiState

@Composable
fun StandbyScreen(uiState: SignageUiState, onOpenAdmin: () -> Unit) {
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

    if (isLandscape) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF070709))
                .padding(48.dp),
            horizontalArrangement = Arrangement.spacedBy(40.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.weight(1f),
                contentAlignment = Alignment.CenterEnd
            ) {
                SignageLogo(uiState = uiState, size = 140.dp, cornerRadius = 20.dp)
            }
            Column(
                modifier = Modifier.weight(1.5f),
                horizontalAlignment = Alignment.Start,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                        "READY FOR ${uiState.whiteLabelName.uppercase()} CONTENT"
                    } else {
                        "READY FOR SYNCED CONTENT"
                    },
                    color = Color(0xFF81C784),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.5.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                        "${uiState.whiteLabelName} Signage Client"
                    } else {
                        "Bluestar Signage Client"
                    },
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.SemiBold
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                        "To stream promos, assign a playlist schedule of active photos or videos on your ${uiState.whiteLabelName} CMS."
                    } else {
                        "To stream promos, assign a playlist schedule of active photos or videos on the Node.js / Pocketbase CMS."
                    },
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp,
                    textAlign = TextAlign.Start,
                    modifier = Modifier.widthIn(max = 480.dp),
                    lineHeight = 18.sp
                )
            }
        }
    } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF070709))
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            SignageLogo(uiState = uiState, size = 160.dp, cornerRadius = 24.dp)

            Spacer(modifier = Modifier.height(30.dp))

            Text(
                text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                    "READY FOR ${uiState.whiteLabelName.uppercase()} CONTENT"
                } else {
                    "READY FOR SYNCED CONTENT"
                },
                color = Color(0xFF81C784),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp
            )

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                    "${uiState.whiteLabelName} Signage Client"
                } else {
                    "Bluestar Signage Client"
                },
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                    "To stream promos, assign a playlist schedule of active photos or videos on your ${uiState.whiteLabelName} CMS."
                } else {
                    "To stream promos, assign a playlist schedule of active photos or videos on the Node.js / Pocketbase CMS."
                },
                color = Color.White.copy(alpha = 0.5f),
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 480.dp),
                lineHeight = 18.sp
            )
        }
    }
}
