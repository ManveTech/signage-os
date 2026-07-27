package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.SignageUiState

@Composable
fun AppSplashScreen(uiState: SignageUiState) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1C1B1F)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            SignageLogo(uiState = uiState, size = 120.dp, cornerRadius = 24.dp)
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) uiState.whiteLabelName else "Bluestar",
                color = Color.White,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) "${uiState.whiteLabelName} Signage Client" else "Signage Player v2.4.1",
                color = Color(0xFF938F99),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp
            )
            
            Spacer(modifier = Modifier.height(48.dp))
            
            CircularProgressIndicator(
                color = Color(0xFFD0BCFF),
                strokeWidth = 3.dp,
                modifier = Modifier.size(28.dp)
            )
        }
    }
}
