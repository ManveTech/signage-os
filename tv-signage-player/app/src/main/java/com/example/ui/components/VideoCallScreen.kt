package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.call.CallState
import com.example.call.VideoCallManager
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

/**
 * Full-screen "meeting" overlay. Rendered by MainActivity in place of normal
 * signage playback whenever [VideoCallManager.callState] leaves Idle — the
 * moment the call ends, MainActivity swaps back to the regular playback loop
 * on its own (this screen holds no signage state itself).
 */
@Composable
fun VideoCallScreen(callManager: VideoCallManager) {
    val callState by callManager.callState.collectAsState()
    val remoteTrack by callManager.remoteVideoTrack.collectAsState()
    val micEnabled by callManager.micEnabled.collectAsState()
    val cameraEnabled by callManager.cameraEnabled.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (remoteTrack != null) {
            RemoteVideoView(track = remoteTrack, eglContext = callManager.eglBase.eglBaseContext)
        } else {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Color.White)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = when (callState) {
                            is CallState.Ringing -> "Incoming call..."
                            is CallState.Connected -> "Connected — waiting for video"
                            else -> "Connecting..."
                        },
                        color = Color.White,
                        fontSize = 16.sp
                    )
                }
            }
        }

        // Status pill top-left
        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(24.dp)
                .background(Color(0xCC111827), shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                .padding(horizontal = 16.dp, vertical = 10.dp)
        ) {
            Text(
                text = when (callState) {
                    is CallState.Ringing -> "Video call — ringing"
                    is CallState.Connected -> "Video call — connected"
                    else -> "Video call"
                },
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        // Control bar bottom
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Color(0xCC0B0B0F))
                .padding(vertical = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CallControlButton(
                icon = if (micEnabled) Icons.Filled.Mic else Icons.Filled.MicOff,
                background = if (micEnabled) Color(0xFF2563EB) else Color(0xFFDC2626),
                contentDescription = "Toggle microphone",
                onClick = { callManager.toggleMic() }
            )
            CallControlButton(
                icon = if (cameraEnabled) Icons.Filled.Videocam else Icons.Filled.VideocamOff,
                background = if (cameraEnabled) Color(0xFF2563EB) else Color(0xFFDC2626),
                contentDescription = "Toggle camera",
                onClick = { callManager.toggleCamera() }
            )
        }
    }
}

@Composable
private fun CallControlButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    background: Color,
    contentDescription: String,
    onClick: () -> Unit
) {
    IconButton(
        onClick = onClick,
        modifier = Modifier
            .size(56.dp)
            .background(background, shape = CircleShape)
    ) {
        Icon(imageVector = icon, contentDescription = contentDescription, tint = Color.White)
    }
}

@Composable
private fun RemoteVideoView(track: VideoTrack?, eglContext: org.webrtc.EglBase.Context) {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            SurfaceViewRenderer(context).apply {
                init(eglContext, null)
                setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
                setEnableHardwareScaler(true)
            }
        },
        update = { renderer -> track?.addSink(renderer) },
        onRelease = { renderer ->
            track?.removeSink(renderer)
            renderer.release()
        }
    )
}
