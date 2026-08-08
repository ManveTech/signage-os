# WebRTC Video Conferencing - Setup & Testing Guide

## What Was Built

Complete P2P WebRTC video conferencing system with:
- ✅ Admin control panel (VideoConferencing.tsx)
- ✅ Display client page (DisplayClient.tsx)
- ✅ WebRTC peer connection handler (webrtcHandler.ts)
- ✅ Socket.io signaling (useVideoConferencing hook)
- ✅ 3 calling modes (1-to-1, group, manual)
- ✅ Real-time connection status tracking
- ✅ Per-display WebRTC state management

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Admin Panel (Browser)                      │
│  VideoConferencing.tsx + WebRTCHandler                        │
│  • Mode selection (1-to-1/group/manual)                       │
│  • Display selection                                          │
│  • Local video preview                                        │
│  • Connection status per display                              │
└─────────────────────────┬──────────────────────────────────────┘
                          │
            Socket.io Signaling (SDP/ICE)
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │Display 1│       │Display 2│       │Display 3│
   │(WiFi)   │       │(WiFi)   │       │(WiFi)   │
   │ /display │       │ /display │       │ /display │
   └────┬────┘       └────┬────┘       └────┬────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
         P2P WebRTC Connection (Direct)
                          │
                    Video Streams
                    (No server relay)
```

---

## Setup Steps

### 1. Start Dev Server

```bash
npm run dev
```

App runs at: `http://localhost:3000` (or configured port)

### 2. Admin Creates Conference

1. **Login** → Admin Dashboard
2. **Navigate** → Video Conferencing (sidebar)
3. **Select Mode**: 1-to-1 / Group / Manual Select
4. **Select Displays**: Check boxes for WiFi displays
5. **Configure Settings**:
   - Default Volume: 0-100%
   - Mute on Start: toggle
6. **Click** "Start Conference"

### 3. Displays Connect

**Each professional display opens browser to**:
```
http://admin-laptop-ip:3000/display
```

**What happens**:
- Display page loads (black screen, "Display Ready")
- Connects to Socket.io server
- Waits for conference initiation signal

### 4. WebRTC Handshake

**When admin clicks "Start Conference"**:

1. **Backend creates conference** in PocketBase
2. **Admin initiates offers** via Socket.io to each display
3. **Each display receives offer** and sends back answer
4. **ICE candidates** exchanged (NAT traversal)
5. **P2P connection established** (video stream flows directly)

**Status progression**:
```
Admin side:           Display side:
"initiating" ────────→ "awaiting"
"waiting" ←───────── "answering"
           ←─ ICE candidates ──→
"connected" ←───────── "connected"
  (video flows)
```

---

## File Structure

```
src/
├── pages/
│   ├── admin-dashboard/
│   │   └── views/
│   │       └── VideoConferencing.tsx    ← Admin control panel
│   └── display/
│       └── DisplayClient.tsx             ← Display page (professionals connect here)
├── utils/
│   └── webrtcHandler.ts                 ← WebRTC peer connection logic
├── hooks/
│   └── useVideoConferencing.ts          ← Socket.io signaling hook
└── App.tsx                               ← Route for /display
```

---

## Testing Locally (Single Machine)

### Open 3 Browser Tabs

**Tab 1: Admin Panel**
```
http://localhost:3000/admin/video-conferencing
```

**Tab 2: Display 1**
```
http://localhost:3000/display
```

**Tab 3: Display 2**
```
http://localhost:3000/display
```

### Test Flow

1. In **Tab 1** (Admin):
   - Select Mode: "Group"
   - You should see 2 displays listed (Tab 2 and Tab 3)
   - Select both
   - Click "Start Conference"

2. In **Tabs 2 & 3** (Displays):
   - Black screen changes to show "🟡 Initiating..."
   - Admin's camera video appears
   - Status changes to "🟢 Connected"

3. In **Tab 1** (Admin):
   - Local video preview shows
   - Active Conferences panel shows "Connected" for each display

4. **End Call**:
   - Click red "End Conference" button
   - Displays go back to "Display Ready"

---

## Cross-Device Testing (Multiple PCs/Displays)

### Step 1: Find Admin PC IP

```bash
# On admin machine
ifconfig | grep inet  # macOS/Linux
ipconfig | grep IPv4   # Windows
```

Example: `192.168.1.100`

### Step 2: Displays Connect

Each professional display opens browser:
```
http://192.168.1.100:3000/display
```

### Step 3: Admin Initiates Call

Admin sees displays connect and initiates conference same as above.

---

## WebRTC Handler API

### Creating a WebRTC Connection

```typescript
import { WebRTCHandler } from '../utils/webrtcHandler';

const webrtc = new WebRTCHandler({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  videoBitrate: 2500,  // Kbps
  audioBitrate: 128    // Kbps
});
```

### Getting Local Stream

```typescript
// Get camera & microphone
const stream = await webrtc.getLocalStream();

// Display in video element
videoElement.srcObject = stream;

// Add to peer connection
await webrtc.addLocalStreamToPeerConnection();
```

### Creating Offer (Admin Side)

```typescript
// Initialize peer connection
await webrtc.initializePeerConnection();

// Get local media
await webrtc.getLocalStream();
await webrtc.addLocalStreamToPeerConnection();

// Handle remote stream from display
webrtc.onRemoteStreamReceived((stream) => {
  remoteVideoElement.srcObject = stream;
});

// Handle ICE candidates
webrtc.onICECandidate((candidate) => {
  if (candidate) {
    socket.emit('webrtc:signal', { signal: candidate });
  }
});

// Create and send offer
const offer = await webrtc.createOffer();
socket.emit('webrtc:signal', { signal: offer });
```

### Handling Offer (Display Side)

```typescript
// Initialize peer connection
await webrtc.initializePeerConnection();

// Handle incoming offer
const answer = await webrtc.handleOffer(offerData);

// Send answer back
socket.emit('webrtc:signal', { signal: answer });

// Continue with ICE candidates...
```

### Adding ICE Candidates

```typescript
// Both sides
await webrtc.addICECandidate(candidateData);
```

### Closing Connection

```typescript
webrtc.close();
```

---

## Socket.io Events

### Admin → Display

```typescript
socket.emit('webrtc:signal', {
  conferenceId: 'conf_123',
  toScreenId: 'screen_456',
  signal: {
    type: 'offer' | 'answer' | 'candidate',
    // ... SDP or ICE data
  }
});
```

### Display → Admin

```typescript
socket.emit('webrtc:signal', {
  conferenceId: 'conf_123',
  signal: {
    type: 'answer' | 'candidate',
    // ... SDP or ICE data
  }
});
```

### Conference Events

```typescript
// Display receives initiation
socket.on('conference:initiated', (data) => {
  console.log('Call incoming:', data.conferenceId);
});

// Display receives call end
socket.on('conference:ended', (data) => {
  console.log('Call ended:', data.conferenceId);
});
```

---

## Debugging

### Check Browser Console

**Tab 1 (Admin)**:
```
[VideoConf] Socket connected: ...
[WebRTC] Offer created and set as local description
[WebRTC] Remote track received: video
[WebRTC] Connection state: connected
```

**Tab 2 (Display)**:
```
[VideoConf] Socket connected: ...
[DisplayClient] Conference initiated: conf_123
[WebRTC] Remote offer set
[WebRTC] Answer created and set as local description
[WebRTC] Connection state: connected
```

### Connection Status Indicators

```
Admin Panel:
  pending ⚪  = Waiting for display response
  initiating 🟡 = Creating offer
  answering 🟡  = Processing answer
  connecting 🟡 = Establishing connection
  connected 🟢  = Video flowing

Display:
  initializing 🟡 = Setting up WebRTC
  answering 🟡    = Sending answer
  waiting-for-admin 🟡 = Waiting for admin offer
  connected 🟢    = Video flowing
```

---

## Known Limitations

1. **Same Network Only**: Without TURN server, cross-ISP/firewall connections may fail
   - Fix: Deploy Coturn server ($5/month VPS) and configure ICE servers

2. **Audio/Video Permissions**: Browser requires HTTPS or localhost
   - Fix: Local testing works fine, production needs SSL

3. **Multiple Calls**: Each admin instance creates separate WebRTC connections
   - Fix: One admin to multiple displays = multiple P2P connections (by design)

4. **Recording Not Included**: WebRTC streams are live only
   - Future: Add MediaRecorder API for recording

---

## Performance Tips

### Adaptive Bitrate

Automatically adjusts video quality:
```typescript
if (cpuUsage > 80%) {
  webrtc.setVideoBitrate(1200);  // Downgrade to 360p
}
```

### Audio/Video Toggle

```typescript
// Mute audio during screen share
webrtc.setAudioEnabled(false);

// Disable video if bandwidth limited
webrtc.setVideoEnabled(false);
```

### Monitor Connection Stats

```typescript
const stats = await webrtc.getStats();
// Check RTCStats for bandwidth, latency, packet loss
```

---

## Troubleshooting

### "No stream from display"

**Possible causes**:
1. Display page didn't load (/display route not found)
   - Fix: Check App.tsx has `/display` route

2. Socket.io not connected
   - Fix: Check browser console for connection errors
   - Verify server is running: `npm run dev`

3. Camera permission denied
   - Fix: Allow camera access in browser permissions

### "Connection fails after 10 seconds"

**Possible cause**: No ICE candidates being exchanged
- Fix: Check TURN server if behind strict firewall
- Try with STUN only first (free Google servers)

### "Admin sees display, but not vice versa"

**Possible cause**: Asymmetric network firewall
- Admin can reach display (outbound allowed)
- Display can't reach admin (inbound blocked)
- Fix: Deploy TURN relay server

---

## Next Steps

1. ✅ Test on localhost with multiple tabs
2. ✅ Test on LAN with multiple PCs
3. ✅ Deploy to staging if cross-network needed
4. ✅ Configure TURN server if needed (`VIDEO_CONFERENCE_ICE_SERVERS` env var)
5. ✅ Add SSL certificate for production
6. ✅ Monitor connection quality with stats API

---

## API Reference

### WebRTCHandler Methods

```typescript
// Initialization
initializePeerConnection()
getLocalStream(constraints?)
addLocalStreamToPeerConnection()

// Signaling
createOffer()
handleOffer(offer)
handleAnswer(answer)
addICECandidate(candidate)

// Events
onRemoteStreamReceived(callback)
onICECandidate(callback)

// Control
setAudioEnabled(bool)
setVideoEnabled(bool)
setVideoBitrate(kbps)

// Cleanup
close()
getStats()
getConnectionState()
getRemoteStream()
```

---

**Ready to test! 🚀**

Run `npm run dev` and open 3 browser tabs to experience video conferencing.
