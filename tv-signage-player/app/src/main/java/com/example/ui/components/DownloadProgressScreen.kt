package com.example.ui.components

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
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
import java.io.File

@Composable
fun DownloadProgressScreen(
    uiState: SignageUiState,
    onTriggerDownloads: () -> Unit,
    onOpenAdmin: () -> Unit
) {
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

    val totalAssets = uiState.playlist.size
    val alreadyDownloaded = uiState.playlist.count { asset ->
        asset.mediaType.equals("youtube", ignoreCase = true) ||
        (!asset.localPath.isNullOrEmpty() && File(asset.localPath).exists())
    }

    if (isLandscape) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0F0E13))
                .padding(horizontal = 32.dp, vertical = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(32.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(bottom = 20.dp)
                ) {
                    SignageLogo(uiState = uiState, size = 44.dp, cornerRadius = 10.dp)

                    Column(verticalArrangement = Arrangement.Center) {
                        Text(
                            text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) uiState.whiteLabelName else "Bluestar",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "SYNCING MEDIA ASSETS",
                            color = Color(0xFF938F99),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                    }
                }

                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.size(150.dp)
                ) {
                    CircularProgressIndicator(
                        progress = { uiState.downloadProgressFraction },
                        modifier = Modifier.size(130.dp),
                        color = if (uiState.isDownloading) Color(0xFFD0BCFF) else Color(0xFFE57373),
                        strokeWidth = 8.dp,
                        trackColor = Color(0xFF2B2930)
                    )

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "${Math.round(uiState.downloadProgressFraction * 100)}%",
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = if (uiState.isDownloading) "SYNCING" else "PAUSED",
                            color = Color(0xFFCAC4D0),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.5.sp
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .weight(1.1f)
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFF1D1B20)
                    ),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFF35343A), RoundedCornerShape(20.dp))
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = if (uiState.isDownloading) "Downloading Display Assets" else "Download Incomplete",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = if (uiState.isDownloading) {
                                uiState.downloadProgressMessage.ifEmpty { "Preparing assets for playback..." }
                            } else {
                                uiState.errorMessage?.let { "Error: $it" } ?: "Download incomplete: $alreadyDownloaded/$totalAssets assets ready. Please verify internet connection."
                            },
                            color = if (uiState.errorMessage != null && !uiState.isDownloading) Color(0xFFE57373) else Color(0xFFEADDFF),
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center,
                            lineHeight = 16.sp
                        )

                        if (!uiState.isDownloading) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = onTriggerDownloads,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF381E72)),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Retry Download", color = Color(0xFFEADDFF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = "Screen playback will begin automatically as soon as all media files are stored locally for seamless offline streaming.",
                            color = Color(0xFF938F99),
                            fontSize = 10.sp,
                            textAlign = TextAlign.Center,
                            lineHeight = 14.sp
                        )
                    }
                }
            }
        }
    } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0F0E13))
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.padding(bottom = 40.dp)
            ) {
                SignageLogo(uiState = uiState, size = 54.dp, cornerRadius = 12.dp)

                Column(verticalArrangement = Arrangement.Center) {
                    Text(
                        text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) uiState.whiteLabelName else "Bluestar",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "SYNCING MEDIA ASSETS",
                        color = Color(0xFF938F99),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.5.sp
                    )
                }
            }

            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(200.dp)
            ) {
                CircularProgressIndicator(
                    progress = { uiState.downloadProgressFraction },
                    modifier = Modifier.size(160.dp),
                    color = if (uiState.isDownloading) Color(0xFFD0BCFF) else Color(0xFFE57373),
                    strokeWidth = 10.dp,
                    trackColor = Color(0xFF2B2930)
                )

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "${Math.round(uiState.downloadProgressFraction * 100)}%",
                        color = Color.White,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        text = if (uiState.isDownloading) "SYNCING" else "PAUSED",
                        color = Color(0xFFCAC4D0),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(40.dp))

            Card(
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFF1D1B20)
                ),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .widthIn(max = 500.dp)
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF35343A), RoundedCornerShape(24.dp))
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = if (uiState.isDownloading) "Downloading Display Assets" else "Download Incomplete",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (uiState.isDownloading) {
                            uiState.downloadProgressMessage.ifEmpty { "Preparing assets for playback..." }
                        } else {
                            uiState.errorMessage?.let { "Error: $it" } ?: "Download incomplete: $alreadyDownloaded/$totalAssets assets ready. Please verify internet connection."
                        },
                        color = if (uiState.errorMessage != null && !uiState.isDownloading) Color(0xFFE57373) else Color(0xFFEADDFF),
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 18.sp
                    )

                    if (!uiState.isDownloading) {
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = onTriggerDownloads,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF381E72)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Retry Download", color = Color(0xFFEADDFF), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Screen playback will begin automatically as soon as all media files are stored locally for seamless offline streaming.",
                        color = Color(0xFF938F99),
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 16.sp
                    )
                }
            }
        }
    }
}
