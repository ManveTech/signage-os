package com.example.call

import android.content.Context
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
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

    // How the caller's picture is laid out: whole (fit, black bars) unless
    // the caller's account chose fill — and always whole while they share
    // their screen, where cut-off edges lose the text.
    private val _callerChoseFill = MutableStateFlow(false)
    private val _callerSharing = MutableStateFlow(false)
    private val _fillScreen = MutableStateFlow(false)
    val fillScreen: StateFlow<Boolean> = _fillScreen.asStateFlow()
    /** Degrees (clockwise) the screen turns its picture; the camera's frames are turned to match. */
    @Volatile var outgoingRotation: Int = 0

    private fun updateFill() { _fillScreen.value = _callerChoseFill.value && !_callerSharing.value }

    // Receive-only chat — this is a TV, there's no keyboard to reply with.
    // Keeps only the last 5 messages, mirroring the web display client.
    private val _chatMessages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val chatMessages: StateFlow<List<ChatMessage>> = _chatMessages.asStateFlow()

    // Emits whenever the server pushes "this screen's config changed" over the
    // socket this manager already holds open — lets the ViewModel re-sync
    // immediately instead of waiting for its next scheduled poll. extraBufferCapacity
    // so a signal isn't lost if it arrives before a collector is attached.
    private val _configChanged = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val configChanged: SharedFlow<Unit> = _configChanged

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

    /**
     * Supplies what this TV reports when the dashboard runs "Check status"
     * (set by the ViewModel, which knows the playback state).
     */
    @Volatile var statusReporter: (() -> JSONObject)? = null

    /** Connects the signaling socket and registers this screen as a call target. */
    fun start(serverUrl: String, screenId: String, hardwareUuid: String = "") {
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
                // With the hardware id the server can check this TV really owns
                // the screen before letting it into the screen's room.
                newSocket.emit("register-display", JSONObject().apply {
                    put("screenId", screenId)
                    put("hardwareUuid", hardwareUuid)
                })
            }
            newSocket.on("conference:initiated") { args -> onConferenceInitiated(args) }
            newSocket.on("conference:ended") { args -> onConferenceEnded(args) }
            newSocket.on("webrtc:signal") { args -> onSignal(args) }
            newSocket.on("chat:message") { args -> onChatMessage(args) }
            newSocket.on("call:screen-share") { args ->
                val data = args.firstOrNull() as? JSONObject
                val id = data?.optString("conferenceId").orEmpty()
                if (data != null && (id.isEmpty() || id == currentConferenceId)) {
                    _callerSharing.value = data.optBoolean("sharing", false)
                    updateFill()
                }
            }
            newSocket.on("screen:config-changed") {
                Log.d(TAG, "Received screen:config-changed push, signaling immediate re-sync")
                _configChanged.tryEmit(Unit)
            }
            // Dashboard "Check status": answer the server's ping right away so it
            // can confirm this TV is alive and update its status.
            newSocket.on("screen:ping") { args ->
                val ack = args.lastOrNull() as? io.socket.client.Ack ?: return@on
                val payload = try {
                    statusReporter?.invoke() ?: JSONObject()
                } catch (e: Exception) {
                    JSONObject()
                }
                payload.put("ok", true)
                payload.put("appVersion", com.example.BuildConfig.VERSION_NAME)
                payload.put("respondedAt", System.currentTimeMillis())
                ack.call(payload)
            }
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
        // Still holding a call — the caller refreshed and rang again, or our
        // socket reconnected and the server replayed this call. The caller will
        // send a fresh offer from a brand-new connection, which the old one
        // can't take, so drop ours first (without telling the server we left).
        if (peerConnection != null || currentConferenceId != null) {
            Log.d(TAG, "New call request while holding ${currentConferenceId ?: "a call"} — starting fresh")
            endCall(notifyServer = false)
        }
        val mode = data.optString("mode", "one-to-one")
        Log.d(TAG, "Conference initiated: $conferenceId")
        com.example.util.Breadcrumbs.mark(context, "conference-initiated")
        pendingRemoteVolume = data.optInt("defaultVolume", 100).coerceIn(0, 100) / 100.0
        callIceServers = parseIceServers(data.optJSONArray("iceServers"))
        relayOnly = data.optString("iceTransportPolicy") == "relay"
        _callerChoseFill.value = data.optBoolean("videoFill", false)
        _callerSharing.value = false
        updateFill()
        currentConferenceId = conferenceId
        _callState.value = CallState.Ringing(conferenceId, mode)
        setupJob = scope.launch { setupPeerConnectionForIncomingCall() }
    }

    private fun onConferenceEnded(args: Array<Any>) {
        // Only the call we're in. A late "ended" for an earlier call (its
        // cleanup runs 15 s after the caller's tab closed) used to hang up the
        // new call the caller had just placed.
        val endedId = (args.firstOrNull() as? JSONObject)?.optString("conferenceId").orEmpty()
        if (endedId.isNotEmpty() && currentConferenceId != null && endedId != currentConferenceId) {
            Log.d(TAG, "Ignoring end of earlier call $endedId (in $currentConferenceId)")
            return
        }
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

    // STUN/TURN servers sent by the server with each call. TURN (a relay)
    // lets the call connect on carrier and corporate networks where the TV
    // and the caller can't reach each other directly; the credentials are
    // short-lived, so they come with the call rather than being built in.
    private var callIceServers: List<PeerConnection.IceServer> = emptyList()
    // Server-side switch (ICE_TRANSPORT_POLICY=relay) to prove the relay works.
    private var relayOnly = false

    private fun parseIceServers(list: org.json.JSONArray?): List<PeerConnection.IceServer> {
        if (list == null) return emptyList()
        val out = mutableListOf<PeerConnection.IceServer>()
        for (i in 0 until list.length()) {
            val entry = list.optJSONObject(i) ?: continue
            val urls = mutableListOf<String>()
            when (val u = entry.opt("urls")) {
                is String -> urls.add(u)
                is org.json.JSONArray -> for (j in 0 until u.length()) u.optString(j).takeIf { it.isNotEmpty() }?.let { urls.add(it) }
            }
            if (urls.isEmpty()) continue
            val builder = PeerConnection.IceServer.builder(urls)
            entry.optString("username").takeIf { it.isNotEmpty() }?.let { builder.setUsername(it) }
            entry.optString("credential").takeIf { it.isNotEmpty() }?.let { builder.setPassword(it) }
            out.add(builder.createIceServer())
        }
        return out
    }

    private suspend fun setupPeerConnectionForIncomingCall() {
        if (peerConnectionFactory == null) {
            com.example.util.Breadcrumbs.mark(context, "pc-factory-init-start")
            initFactory()
            com.example.util.Breadcrumbs.mark(context, "pc-factory-init-done")
        }
        if (peerConnection != null) return

        val rtcConfig = PeerConnection.RTCConfiguration(
            callIceServers.ifEmpty { listOf(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()) }
        )
        if (relayOnly) rtcConfig.iceTransportsType = PeerConnection.IceTransportsType.RELAY

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
        // VP8/VP9 (what Chrome sends) are decoded in software. Many TV boxes'
        // hardware decoders freeze when the picture size changes mid-call —
        // camera to a shared screen — and keep showing the last frame while
        // the call carries on ("video paused" on screen share). libvpx handles
        // size changes on every device, and 1080p at 15 fps (the screen-share
        // cap) is well within a TV box's CPU. Other codecs stay on hardware.
        val hardwareDecoders = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        val softwareDecoders = org.webrtc.SoftwareVideoDecoderFactory()
        val decoderFactory = object : org.webrtc.VideoDecoderFactory {
            override fun createDecoder(info: org.webrtc.VideoCodecInfo): org.webrtc.VideoDecoder? {
                val software = info.name.equals("VP8", ignoreCase = true) || info.name.equals("VP9", ignoreCase = true)
                return (if (software) softwareDecoders.createDecoder(info) else null) ?: hardwareDecoders.createDecoder(info)
            }
            override fun getSupportedCodecs(): Array<org.webrtc.VideoCodecInfo> =
                (hardwareDecoders.supportedCodecs + softwareDecoders.supportedCodecs).distinctBy { it.name.uppercase() }.toTypedArray()
        }
        // WebRTC's own echo canceller and noise suppressor instead of the
        // device's: on many Android TV boxes the built-in ones are missing or
        // poor, and a TV's loud speaker right next to its mic is exactly the
        // case they have to handle. Software AEC behaves the same everywhere.
        val audioDeviceModule = org.webrtc.audio.JavaAudioDeviceModule.builder(context)
            .setUseHardwareAcousticEchoCanceler(false)
            .setUseHardwareNoiseSuppressor(false)
            .createAudioDeviceModule()
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(audioDeviceModule)
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
        audioDeviceModule.release()
    }

    private fun attachLocalMedia() {
        val factory = peerConnectionFactory ?: return
        val pc = peerConnection ?: return

        val audioConstraints = MediaConstraints().apply {
            listOf("googEchoCancellation", "googNoiseSuppression", "googAutoGainControl", "googHighpassFilter")
                .forEach { mandatory.add(MediaConstraints.KeyValuePair(it, "true")) }
        }
        val audioSource = factory.createAudioSource(audioConstraints)
        localAudioTrack = factory.createAudioTrack("audio0", audioSource)
        // TVs always join muted, so a room with several screens doesn't open
        // with every mic live (decided 2026-10-28). Someone at the TV unmutes
        // with the remote.
        localAudioTrack?.setEnabled(false)
        _micEnabled.value = false
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
        // A portrait screen turns its picture (see MainActivity); a camera fixed
        // to the display turns with it, so its frames are turned the same way
        // and the caller sees an upright, tall picture.
        videoSource.setVideoProcessor(object : org.webrtc.VideoProcessor {
            private var sink: org.webrtc.VideoSink? = null
            override fun setSink(sink: org.webrtc.VideoSink?) { this.sink = sink }
            override fun onCapturerStarted(success: Boolean) {}
            override fun onCapturerStopped() {}
            override fun onFrameCaptured(frame: org.webrtc.VideoFrame) {
                val extra = outgoingRotation
                sink?.onFrame(if (extra % 360 == 0) frame else org.webrtc.VideoFrame(frame.buffer, (frame.rotation + extra) % 360, frame.timestampNs))
            }
        })
        capturer.initialize(helper, context, videoSource.capturerObserver)
        capturer.startCapture(1280, 720, 30)

        val videoTrack = factory.createVideoTrack("video0", videoSource)
        localVideoTrack = videoTrack
        _localVideoTrackFlow.value = videoTrack
        videoTrack.setEnabled(true)
        pc.addTrack(videoTrack, listOf("stream0"))
    }

    // The caller sends its ICE candidates right after the offer, and each
    // signal is handled in its own coroutine — so a candidate could reach
    // addIceCandidate while the offer was still being applied, and be
    // rejected (there is no remote description yet). They wait here instead.
    private val pendingCandidates = mutableListOf<IceCandidate>()
    private var remoteDescriptionSet = false

    // The connection is set up in the background when the call arrives; the
    // caller's offer can come in before that finishes (the first call after
    // the app starts also loads WebRTC), and was then dropped — the call just
    // hung on "connecting". The offer waits for the setup instead.
    private var setupJob: Job? = null

    private suspend fun handleOffer(signal: JSONObject) {
        setupJob?.join()
        val pc = peerConnection ?: return
        val sdp = SessionDescription(SessionDescription.Type.OFFER, signal.optString("sdp"))
        setRemoteDescription(pc, sdp)
        val queued = synchronized(pendingCandidates) {
            remoteDescriptionSet = true
            pendingCandidates.toList().also { pendingCandidates.clear() }
        }
        queued.forEach { pc.addIceCandidate(it) }

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
        val candidate = IceCandidate(
            signal.optString("sdpMid"),
            signal.optInt("sdpMLineIndex"),
            signal.optString("candidate")
        )
        val ready = synchronized(pendingCandidates) {
            if (!remoteDescriptionSet) pendingCandidates.add(candidate)
            remoteDescriptionSet
        }
        if (ready) peerConnection?.addIceCandidate(candidate)
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
        synchronized(pendingCandidates) {
            pendingCandidates.clear()
            remoteDescriptionSet = false
        }

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
        _callerSharing.value = false
        updateFill()
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
