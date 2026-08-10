package com.example.call

import android.content.Context
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import org.webrtc.AudioTrack
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoTrack
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Normal signage playback is untouched by this manager — it only ever does
 * anything on screens with cameraMountEnabled = true, and MainActivity only
 * swaps to the call UI when [callState] leaves [CallState.Idle].
 */
sealed class CallState {
    data object Idle : CallState()
    data class Ringing(val conferenceId: String, val mode: String) : CallState()
    data class Connected(val conferenceId: String) : CallState()
}

data class ChatMessage(val senderName: String, val text: String, val ts: Long)

class VideoCallManager(private val context: Context) {

    companion object {
        private const val TAG = "VideoCallManager"
    }

    private val scope = CoroutineScope(Dispatchers.Main + Job())

    private val _callState = MutableStateFlow<CallState>(CallState.Idle)
    val callState: StateFlow<CallState> = _callState.asStateFlow()

    private val _remoteVideoTrack = MutableStateFlow<VideoTrack?>(null)
    val remoteVideoTrack: StateFlow<VideoTrack?> = _remoteVideoTrack.asStateFlow()

    private val _localVideoTrackFlow = MutableStateFlow<VideoTrack?>(null)
    val localVideoTrackFlow: StateFlow<VideoTrack?> = _localVideoTrackFlow.asStateFlow()

    private val _micEnabled = MutableStateFlow(false)
    val micEnabled: StateFlow<Boolean> = _micEnabled.asStateFlow()

    private val _cameraEnabled = MutableStateFlow(true)
    val cameraEnabled: StateFlow<Boolean> = _cameraEnabled.asStateFlow()

    // Receive-only chat — this is a TV, there's no keyboard to reply with.
    // Keeps only the last 5 messages, mirroring the web display client.
    private val _chatMessages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val chatMessages: StateFlow<List<ChatMessage>> = _chatMessages.asStateFlow()

    val eglBase: EglBase = EglBase.create()

    private var socket: Socket? = null
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var localAudioTrack: AudioTrack? = null
    private var localVideoTrack: VideoTrack? = null
    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var currentConferenceId: String? = null
    private var registeredScreenId: String? = null
    // Set from conference:initiated's defaultVolume (0-100, same value sent to
    // every target screen) and applied once the remote audio track attaches —
    // WebRTC audio tracks otherwise always play out at unity gain regardless
    // of what the caller configured.
    private var pendingRemoteVolume: Double = 1.0

    /** Connects the signaling socket and registers this screen as a call target. */
    fun start(serverUrl: String, screenId: String) {
        if (socket != null && registeredScreenId == screenId) return
        stop()
        registeredScreenId = screenId

        try {
            val options = IO.Options.builder()
                .setTransports(arrayOf("websocket"))
                .setReconnection(true)
                .build()
            val newSocket = IO.socket(serverUrl, options)
            socket = newSocket

            newSocket.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Socket connected, registering display $screenId")
                com.example.util.Breadcrumbs.mark(context, "socket-connected")
                newSocket.emit("register-display", screenId)
            }
            newSocket.on("conference:initiated") { args -> onConferenceInitiated(args) }
            newSocket.on("conference:ended") { onConferenceEnded() }
            newSocket.on("webrtc:signal") { args -> onSignal(args) }
            newSocket.on("chat:message") { args -> onChatMessage(args) }
            newSocket.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.w(TAG, "Socket connect error: ${args.firstOrNull()}")
            }

            newSocket.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start call signaling", e)
        }
    }

    /**
     * Disconnects everything. Safe to call even if nothing is active.
     * [notifyServer] must be false when this is called because the process itself
     * is tearing down (e.g. ViewModel.onCleared on app quit) rather than because
     * the user actually hung up — otherwise the server deletes its record of the
     * active conference and the mid-conference replay on the next launch has
     * nothing left to replay.
     */
    fun stop(notifyServer: Boolean = true) {
        endCall(notifyServer)
        socket?.disconnect()
        socket?.off()
        socket = null
        registeredScreenId = null
    }

    private fun onConferenceInitiated(args: Array<Any>) {
        val data = args.firstOrNull() as? JSONObject ?: return
        val conferenceId = data.optString("conferenceId").takeIf { it.isNotEmpty() } ?: return
        val mode = data.optString("mode", "one-to-one")
        Log.d(TAG, "Conference initiated: $conferenceId")
        com.example.util.Breadcrumbs.mark(context, "conference-initiated")
        pendingRemoteVolume = data.optInt("defaultVolume", 100).coerceIn(0, 100) / 100.0
        currentConferenceId = conferenceId
        _callState.value = CallState.Ringing(conferenceId, mode)
        scope.launch { setupPeerConnectionForIncomingCall() }
    }

    private fun onConferenceEnded() {
        Log.d(TAG, "Conference ended by caller")
        endCall()
    }

    private fun onChatMessage(args: Array<Any>) {
        val data = args.firstOrNull() as? JSONObject ?: return
        val senderName = data.optString("senderName").ifEmpty { "Caller" }
        val text = data.optString("text")
        if (text.isEmpty()) return
        val ts = data.optLong("ts", System.currentTimeMillis())
        _chatMessages.value = (_chatMessages.value + ChatMessage(senderName, text, ts)).takeLast(5)
    }

    private fun onSignal(args: Array<Any>) {
        val data = args.firstOrNull() as? JSONObject ?: return
        val signal = data.optJSONObject("signal") ?: return
        val type = signal.optString("type")

        scope.launch {
            try {
                when {
                    type == "offer" -> handleOffer(signal)
                    signal.has("candidate") -> handleRemoteCandidate(signal)
                    else -> Log.w(TAG, "Unhandled signal type: $type")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling signal", e)
            }
        }
    }

    private suspend fun setupPeerConnectionForIncomingCall() {
        if (peerConnectionFactory == null) {
            com.example.util.Breadcrumbs.mark(context, "pc-factory-init-start")
            initFactory()
            com.example.util.Breadcrumbs.mark(context, "pc-factory-init-done")
        }
        if (peerConnection != null) return

        val rtcConfig = PeerConnection.RTCConfiguration(
            listOf(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())
        )

        peerConnection = peerConnectionFactory!!.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate ?: return
                val conferenceId = currentConferenceId ?: return
                val payload = JSONObject().apply {
                    put("conferenceId", conferenceId)
                    put("screenId", registeredScreenId)
                    put("signal", JSONObject().apply {
                        put("type", "candidate")
                        put("candidate", candidate.sdp)
                        put("sdpMLineIndex", candidate.sdpMLineIndex)
                        put("sdpMid", candidate.sdpMid)
                    })
                }
                socket?.emit("webrtc:signal", payload)
            }

            override fun onAddStream(stream: MediaStream?) {
                val track = stream?.videoTracks?.firstOrNull()
                if (track != null) {
                    _remoteVideoTrack.value = track
                }
                stream?.audioTracks?.firstOrNull()?.setVolume(pendingRemoteVolume)
            }

            override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
                Log.d(TAG, "Connection state: $newState")
                if (newState == PeerConnection.PeerConnectionState.CONNECTED) {
                    com.example.util.Breadcrumbs.mark(context, "call-connected")
                    currentConferenceId?.let { _callState.value = CallState.Connected(it) }
                } else if (newState == PeerConnection.PeerConnectionState.FAILED ||
                    newState == PeerConnection.PeerConnectionState.CLOSED
                ) {
                    endCall()
                }
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(channel: org.webrtc.DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
                val track = receiver?.track()
                if (track is VideoTrack) {
                    _remoteVideoTrack.value = track
                } else if (track is AudioTrack) {
                    track.setVolume(pendingRemoteVolume)
                }
            }
        })

        // A missing camera/mic must never block the call — the display just
        // sends no local media back, mirroring the web client's fallback.
        com.example.util.Breadcrumbs.mark(context, "local-media-attach-start")
        try {
            attachLocalMedia()
        } catch (e: Exception) {
            Log.w(TAG, "Could not attach local camera/mic, continuing receive-only", e)
        }
        com.example.util.Breadcrumbs.mark(context, "local-media-attach-done")
    }

    private fun initFactory() {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context)
                .setEnableInternalTracer(false)
                .createInitializationOptions()
        )
        val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
    }

    private fun attachLocalMedia() {
        val factory = peerConnectionFactory ?: return
        val pc = peerConnection ?: return

        val audioSource = factory.createAudioSource(MediaConstraints())
        localAudioTrack = factory.createAudioTrack("audio0", audioSource)
        // TVs join meetings muted by default so a room full of screens doesn't
        // open with every mic hot; the caller/screen can unmute explicitly.
        localAudioTrack?.setEnabled(false)
        localAudioTrack?.let { pc.addTrack(it, listOf("stream0")) }

        val enumerator = Camera2Enumerator(context)
        val deviceName = enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }
            ?: enumerator.deviceNames.firstOrNull()
        if (deviceName == null) {
            Log.w(TAG, "No camera available on this device")
            return
        }

        val capturer: CameraVideoCapturer = enumerator.createCapturer(deviceName, null) ?: return
        videoCapturer = capturer

        val helper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        surfaceTextureHelper = helper
        val videoSource = factory.createVideoSource(capturer.isScreencast)
        capturer.initialize(helper, context, videoSource.capturerObserver)
        capturer.startCapture(1280, 720, 30)

        val videoTrack = factory.createVideoTrack("video0", videoSource)
        localVideoTrack = videoTrack
        _localVideoTrackFlow.value = videoTrack
        videoTrack.setEnabled(true)
        pc.addTrack(videoTrack, listOf("stream0"))
    }

    private suspend fun handleOffer(signal: JSONObject) {
        val pc = peerConnection ?: return
        val sdp = SessionDescription(SessionDescription.Type.OFFER, signal.optString("sdp"))
        setRemoteDescription(pc, sdp)

        val answer = createAnswer(pc)
        setLocalDescription(pc, answer)

        val conferenceId = currentConferenceId ?: return
        val payload = JSONObject().apply {
            put("conferenceId", conferenceId)
            put("screenId", registeredScreenId)
            put("signal", JSONObject().apply {
                put("type", "answer")
                put("sdp", answer.description)
            })
        }
        socket?.emit("webrtc:signal", payload)
    }

    private fun handleRemoteCandidate(signal: JSONObject) {
        val pc = peerConnection ?: return
        val candidate = IceCandidate(
            signal.optString("sdpMid"),
            signal.optInt("sdpMLineIndex"),
            signal.optString("candidate")
        )
        pc.addIceCandidate(candidate)
    }

    fun toggleMic() {
        val enabled = !_micEnabled.value
        localAudioTrack?.setEnabled(enabled)
        _micEnabled.value = enabled
    }

    fun toggleCamera() {
        val enabled = !_cameraEnabled.value
        localVideoTrack?.setEnabled(enabled)
        _cameraEnabled.value = enabled
    }

    fun endCall(notifyServer: Boolean = true) {
        // Already torn down (or mid-teardown via the re-entrant path below) — nothing to do.
        if (peerConnection == null && currentConferenceId == null && _callState.value is CallState.Idle) return

        val conferenceId = currentConferenceId
        if (conferenceId != null && notifyServer) {
            socket?.emit("video:leave-conference", JSONObject().apply { put("conferenceId", conferenceId) })
        }
        currentConferenceId = null

        try {
            videoCapturer?.stopCapture()
        } catch (_: Exception) {}
        videoCapturer?.dispose()
        videoCapturer = null
        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null
        localVideoTrack?.dispose()
        localVideoTrack = null
        localAudioTrack?.dispose()
        localAudioTrack = null

        // pc.close() synchronously re-enters onConnectionChange(CLOSED) on this
        // same thread before returning — which used to call back into endCall()
        // while `peerConnection` still pointed at the same connection, causing
        // infinite recursion (endCall -> close -> onConnectionChange -> endCall
        // -> ...) that stack-overflowed and SIGABRT-crashed the whole app.
        // Nulling the field out before calling close() on the local copy means
        // that re-entrant call sees peerConnection == null and does nothing.
        val pc = peerConnection
        peerConnection = null
        pc?.close()

        _remoteVideoTrack.value = null
        _localVideoTrackFlow.value = null
        _micEnabled.value = false
        _cameraEnabled.value = true
        _chatMessages.value = emptyList()
        _callState.value = CallState.Idle
        com.example.util.Breadcrumbs.mark(context, "call-ended-clean")
    }

    private suspend fun setRemoteDescription(pc: PeerConnection, sdp: SessionDescription) =
        suspendCancellableCoroutine<Unit> { cont ->
            pc.setRemoteDescription(object : SdpObserver {
                override fun onSetSuccess() {
                    if (cont.isActive) cont.resume(Unit)
                }
                override fun onSetFailure(error: String?) {
                    if (cont.isActive) cont.resumeWithException(Exception("setRemoteDescription failed: $error"))
                }
                override fun onCreateSuccess(description: SessionDescription?) {}
                override fun onCreateFailure(error: String?) {}
            }, sdp)
        }

    private suspend fun setLocalDescription(pc: PeerConnection, sdp: SessionDescription) =
        suspendCancellableCoroutine<Unit> { cont ->
            pc.setLocalDescription(object : SdpObserver {
                override fun onSetSuccess() {
                    if (cont.isActive) cont.resume(Unit)
                }
                override fun onSetFailure(error: String?) {
                    if (cont.isActive) cont.resumeWithException(Exception("setLocalDescription failed: $error"))
                }
                override fun onCreateSuccess(description: SessionDescription?) {}
                override fun onCreateFailure(error: String?) {}
            }, sdp)
        }

    private suspend fun createAnswer(pc: PeerConnection): SessionDescription =
        suspendCancellableCoroutine { cont ->
            pc.createAnswer(object : SdpObserver {
                override fun onCreateSuccess(description: SessionDescription?) {
                    if (description != null && cont.isActive) {
                        cont.resume(description)
                    } else if (cont.isActive) {
                        cont.resumeWithException(Exception("createAnswer returned null"))
                    }
                }
                override fun onCreateFailure(error: String?) {
                    if (cont.isActive) cont.resumeWithException(Exception("createAnswer failed: $error"))
                }
                override fun onSetSuccess() {}
                override fun onSetFailure(error: String?) {}
            }, MediaConstraints())
        }
}
