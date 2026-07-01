# Tizen Signage Player App Context

This directory contains the Tizen Web Application implementation for the SignageOS Player. When you open this folder and start the AI, use this file to understand the architecture, context, and feature parity with the Android TV player.

## Project Structure
* **`config.xml`**: Tizen Application Manifest. Sets permissions (Internet, TV inputs, Audio, Filesystem Read/Write, Download), landscape orientation, and auto-start.
* **`index.html`**: Main viewport layout. Manages distinct UI states (Splash, Pairing, Standby, Suspended, Playback) and hud overlays.
* **`index.css`**: Styling sheets for fullscreen content, transitions, and widgetHUD layouts.
* **`app.js`**: Core Javascript Player Engine. Handles state synchronization, API loops, and playback rotations.
* **`.project`**: Tizen project descriptor file required by the VS Code Tizen Extension.

---

## Feature Parity with Android Player

### 1. Networking & Backend URLs
All calls connect to the production endpoints:
* **Server API URL**: `https://dem1.manve.co`
* **PocketBase URL**: `https://demo.manve.co`

### 2. Device Pairing
* Generates a persistent UUID stored in `localStorage`.
* Requests a pairing code from `https://dem1.manve.co/api/v1/devices/pairing-code` if unregistered.
* Displays the 6-character code and polls the screen record until status changes from `pairing` to `active`/`online`.

### 3. Sync & Heartbeat Engines
* **Screen Sync (Every 7.5s)**: Polls the PocketBase collection record `screens/records/{screenId}` to get the latest status, volume settings, active playlist, and commands.
* **Diagnostic Heartbeat (Every 30s)**: Sends diagnostic payload (UUID, CPU temp, current asset filename, mock storage bytes) to the `/api/v1/devices/heartbeat` API endpoint.

### 4. Parity Commands & Triggers
* **`clear_cache`**: Clears playlist and widget definitions from cache/localStorage.
* **`force_sync`**: Clears cached playlist data, resets play index, and resets the flag on the server.
* **`restart_playlist`**: Resets active asset index to `0` and resets the flag on the server.
* **Schedule Switching**: Automatically switches active playlists based on `schedulePlaylist`, `scheduleDate`, and `scheduleTime`, and clears the schedule on the server.
* **Auto-unpair on 404 / 24h Offline**: Automatically wipes the local cache and returns to pairing screen if the record is deleted (404) or if the device fails to sync with the server for more than 24 hours.

### 5. Playback & Fallbacks
* Maps active playlist slides and runs fallback logic in the same order as Android (Slides -> AssetsJson -> Files -> MediaIds).
* Supports **Shuffle Mode** (shuffling arrays before starting rotation).
* Supports **Transition Effects** (toggling CSS opacity animations based on the `transition` setting).
* Supports **Loop Restriction** (pausing automatic rotation at the end if loop is false).

### 6. Dynamic HUD Widgets
Renders overlays based on active placement (`top-left`, `top-right`, `bottom-left`, `bottom-right`):
* **QR Code**: Generates a quick scan code using the URL endpoint.
* **Clock**: Displays the current time updated every second.
* **Weather**: Renders temperature and condition indicators.
* **RSS Ticker**: Renders an animated scrolling news line at the bottom.

---

## Tizen TV Specific Features

### 1. Auto-Start
Enabled by `<tizen:setting auto-start="enable"/>` in `config.xml` to boot the app automatically when the TV turns on.

### 2. Auto-Recall on Exit (15-Second Alarm)
If the app moves to the background or closes (`visibilitychange` triggers `hidden`), Tizen's relative alarm API is scheduled to re-launch the app:
```javascript
const alarm = new window.tizen.AlarmRelative(15);
window.tizen.alarm.add(alarm, appId);
```
If the app returns to the foreground, all active alarms are cleared to avoid duplication.
