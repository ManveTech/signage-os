/**
 * SignageOS Player - Tizen Web Client Engine
 */

(function () {
    // Config Constants (pointing to backend endpoints)
    const SERVER_URL = 'https://dem1.manve.co'; // Target server URL. Will be resolved to match PocketBase settings.
    let POCKETBASE_URL = 'https://demo.manve.co'; // Resolved during pairing

    // Local Storage state keys
    const KEYS = {
        UUID: 'signage_tizen_uuid',
        SCREEN_ID: 'signage_tizen_screen_id',
        PAIRING_CODE: 'signage_tizen_pairing_code',
        STATUS: 'signage_tizen_status',
        PLAYLIST: 'signage_tizen_playlist',
        WIDGET: 'signage_tizen_widget',
        VOLUME: 'signage_tizen_volume',
        BRANDING: 'signage_tizen_branding'
    };

    // State Variables
    let state = {
        uuid: getOrGenerateUUID(),
        screenId: localStorage.getItem(KEYS.SCREEN_ID) || '',
        pairingCode: localStorage.getItem(KEYS.PAIRING_CODE) || '',
        status: localStorage.getItem(KEYS.STATUS) || 'pairing',
        playlist: JSON.parse(localStorage.getItem(KEYS.PLAYLIST) || '[]'),
        currentAssetIndex: 0,
        volume: parseInt(localStorage.getItem(KEYS.VOLUME) || '80'),
        branding: JSON.parse(localStorage.getItem(KEYS.BRANDING) || '{}'),
        widget: JSON.parse(localStorage.getItem(KEYS.WIDGET) || '{}')
    };

    // Elements
    const views = {
        splash: document.getElementById('splash-screen'),
        pairing: document.getElementById('pairing-screen'),
        standby: document.getElementById('standby-screen'),
        suspended: document.getElementById('suspended-screen'),
        playback: document.getElementById('playback-screen'),
        pairingCodeText: document.getElementById('pairing-code'),
        pairingStatusMsg: document.getElementById('pairing-status-message'),
        refreshCodeBtn: document.getElementById('refresh-code-btn'),
        imagePlayer: document.getElementById('image-player'),
        videoPlayer: document.getElementById('video-player'),
        splashLogo: document.getElementById('splash-logo'),
        splashName: document.getElementById('splash-name'),
        splashStatus: document.getElementById('splash-status')
    };

    const widgets = {
        overlay: document.getElementById('widgets-overlay'),
        qrcode: document.getElementById('widget-qrcode'),
        qrcodeImg: document.getElementById('qrcode-img'),
        weather: document.getElementById('widget-weather'),
        clock: document.getElementById('widget-clock'),
        clockTime: document.getElementById('clock-time'),
        clockTitle: document.getElementById('clock-title'),
        rss: document.getElementById('widget-rss'),
        rssText: document.getElementById('rss-text')
    };

    // Loop Timers
    let rotationTimeout = null;
    let syncInterval = null;
    let heartbeatInterval = null;
    let clockInterval = null;

    // Initialize application
    function init() {
        console.log("Initializing SignageOS Tizen App...");
        applyBranding();
        bindEvents();
        updateUI();

        // Clear any pending auto-launch alarms (if we just opened)
        cancelAutoLaunchAlarm();

        // Listen for visibility changes (background / exit state)
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // If paired already, immediately query config, else start in pairing mode
        if (state.screenId) {
            POCKETBASE_URL = localStorage.getItem('signage_tizen_pb_url') || POCKETBASE_URL;
            fetchScreenConfig().then(() => {
                views.splash.classList.remove('active');
            });
        } else {
            // Generate/request code
            requestPairingCode().then(() => {
                views.splash.classList.remove('active');
            });
        }

        // Start periodic sync and heartbeat processes
        startSyncLoops();
        startClockWidget();
    }

    // Handle background transition or exit
    function handleVisibilityChange() {
        if (document.hidden) {
            console.log("App moved to background / hidden. Scheduling auto-launch alarm in 15 seconds...");
            scheduleAutoLaunchAlarm();
        } else {
            console.log("App returned to foreground. Cancelling auto-launch alarm.");
            cancelAutoLaunchAlarm();
        }
    }

    // Schedule Tizen Alarm to launch this app in 15 seconds
    function scheduleAutoLaunchAlarm() {
        try {
            if (window.tizen && window.tizen.alarm && window.tizen.application) {
                const appId = window.tizen.application.getCurrentApplication().appId;
                
                // Clear any existing alarms first
                cancelAutoLaunchAlarm();

                // Schedule alarm for 15 seconds from now
                const alarm = new window.tizen.AlarmRelative(15);
                window.tizen.alarm.add(alarm, appId);
                console.log(`Successfully scheduled Tizen auto-launch alarm for appId: ${appId}`);
            } else {
                console.warn("Tizen Alarm API not available in this environment.");
            }
        } catch (e) {
            console.error("Failed to schedule auto-launch alarm:", e);
        }
    }

    // Cancel any scheduled auto-launch alarms
    function cancelAutoLaunchAlarm() {
        try {
            if (window.tizen && window.tizen.alarm && window.tizen.application) {
                const appId = window.tizen.application.getCurrentApplication().appId;
                const alarms = window.tizen.alarm.getAll();
                alarms.forEach(alarm => {
                    // Tizen Alarm object contains the ID and target appId
                    if (alarm.appId === appId || alarm.id) {
                        window.tizen.alarm.remove(alarm.id);
                    }
                });
                console.log("Cleared all pending Tizen auto-launch alarms.");
            }
        } catch (e) {
            console.error("Failed to clear auto-launch alarms:", e);
        }
    }

    // Bind event handlers
    function bindEvents() {
        views.refreshCodeBtn.addEventListener('click', () => {
            views.refreshCodeBtn.disabled = true;
            views.refreshCodeBtn.innerText = "Requesting...";
            requestPairingCode().finally(() => {
                views.refreshCodeBtn.disabled = false;
                views.refreshCodeBtn.innerText = "Get New Code";
            });
        });

        // Loop next media on video end
        views.videoPlayer.addEventListener('ended', () => {
            console.log("Video playback complete, advancing index.");
            advancePlaylist();
        });

        views.videoPlayer.addEventListener('error', (e) => {
            console.error("Video element error, skipping asset.", e);
            reportError('Video playback error', e.message || 'unknown');
            advancePlaylist();
        });
    }

    // Get or generate hardware UUID
    function getOrGenerateUUID() {
        let uuid = localStorage.getItem(KEYS.UUID);
        if (!uuid) {
            uuid = 'tizen-uuid-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem(KEYS.UUID, uuid);
        }
        return uuid;
    }

    // Render whitelabel branding
    function applyBranding() {
        if (state.branding && state.branding.isWhiteLabel) {
            if (state.branding.logoUrl) {
                views.splashLogo.src = state.branding.logoUrl;
            }
            if (state.branding.name) {
                views.splashName.innerText = state.branding.name;
            }
        }
    }

    // Show appropriate screen based on state
    function updateUI() {
        // Deactivate all screens
        Object.values(views).forEach(v => {
            if (v && v.classList && v.classList.contains('screen')) {
                v.classList.remove('active');
            }
        });

        // Hide overlay widgets by default
        widgets.qrcode.classList.add('hidden');
        widgets.weather.classList.add('hidden');
        widgets.clock.classList.add('hidden');
        widgets.rss.classList.add('hidden');

        console.log(`Updating UI state: ${state.status}`);

        switch (state.status) {
            case 'pairing':
                views.pairingCodeText.innerText = state.pairingCode || '------';
                views.pairing.classList.add('active');
                break;
            case 'suspended':
                views.suspended.classList.add('active');
                break;
            case 'active':
            case 'online':
            case 'offline':
                if (!state.playlist || state.playlist.length === 0) {
                    views.standby.classList.add('active');
                } else {
                    views.playback.classList.add('active');
                    startPlaylistRotation();
                    renderWidgets();
                }
                break;
            default:
                views.pairing.classList.add('active');
                break;
        }
    }

    // Request Pairing Code from backend API
    async function requestPairingCode() {
        try {
            const res = await fetch(`${SERVER_URL}/api/v1/devices/pairing-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hardwareUuid: state.uuid })
            });

            if (!res.ok) throw new Error('API pairing code call failed');
            const data = await res.json();

            state.pairingCode = data.pairingCode;
            state.screenId = data.screenId;
            state.status = 'pairing';
            if (data.pocketbaseUrl) {
                POCKETBASE_URL = data.pocketbaseUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname);
                localStorage.setItem('signage_tizen_pb_url', POCKETBASE_URL);
            }

            localStorage.setItem(KEYS.PAIRING_CODE, state.pairingCode);
            localStorage.setItem(KEYS.SCREEN_ID, state.screenId);
            localStorage.setItem(KEYS.STATUS, state.status);

            views.pairingCodeText.innerText = state.pairingCode;
            views.pairingStatusMsg.innerText = "Awaiting pairing from dashboard...";
            updateUI();
        } catch (err) {
            console.error("Error fetching pairing code:", err);
            views.pairingStatusMsg.innerText = "Connection failed. Retrying...";
        }
    }

    // Query screen state from PocketBase backend
    async function fetchScreenConfig() {
        if (!state.screenId) return;
        try {
            const url = `${POCKETBASE_URL}/api/collections/screens/records/${state.screenId}`;
            const res = await fetch(url);
            if (!res.ok) {
                if (res.status === 404) {
                    // Screen was deleted/disconnected on CMS. Go back to pairing.
                    disconnectDevice();
                    return;
                }
                throw new Error('Failed to retrieve screen record');
            }

            const data = await res.json();
            
            // Update last synced timestamp
            state.lastSyncedAt = Date.now();
            localStorage.setItem('signage_tizen_last_sync', state.lastSyncedAt);
            
            // Check status transition
            const oldStatus = state.status;
            state.status = data.status || 'pairing';
            state.volume = data.volume || 80;

            localStorage.setItem(KEYS.STATUS, state.status);
            localStorage.setItem(KEYS.VOLUME, state.volume);

            // Sync branding
            state.branding = {
                isWhiteLabel: !!data.whiteLabel,
                logoUrl: data.websiteLogo || '',
                name: data.websiteName || ''
            };
            localStorage.setItem(KEYS.BRANDING, JSON.stringify(state.branding));
            applyBranding();

            // 1. Clear Cache commands
            if (data.clear_cache) {
                console.log("Received clear cache instruction.");
                localStorage.removeItem(KEYS.PLAYLIST);
                state.playlist = [];
                // Clear on server
                await fetch(url, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clear_cache: false })
                });
            }

            // 2. Force Sync command
            if (data.force_sync) {
                console.log("Received force sync instruction.");
                localStorage.removeItem(KEYS.PLAYLIST);
                state.playlist = [];
                state.currentAssetIndex = 0;
                // Clear force_sync flag on server
                await fetch(url, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ force_sync: false })
                });
            }

            // 3. Restart Playlist command
            if (data.restart_playlist) {
                console.log("Received restart playlist instruction.");
                state.currentAssetIndex = 0;
                // Clear restart_playlist flag on server
                await fetch(url, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ restart_playlist: false })
                });
                startPlaylistRotation();
            }

            // 4. Scheduled playlist check
            let activePlaylistId = data.playlistId || data.playlist;
            if (data.schedulePlaylist && data.scheduleDate && data.scheduleTime) {
                if (isScheduleDue(data.scheduleDate, data.scheduleTime)) {
                    console.log(`Schedule triggered! Switching active playlist to: ${data.schedulePlaylist}`);
                    const scheduledPlaylistId = await fetchScheduledPlaylistId(data.schedulePlaylist);
                    if (scheduledPlaylistId) {
                        activePlaylistId = scheduledPlaylistId;
                        // Update on server
                        await fetch(url, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                playlist: scheduledPlaylistId,
                                playlistId: scheduledPlaylistId,
                                schedulePlaylist: '',
                                scheduleDate: '',
                                scheduleTime: ''
                            })
                        });
                    }
                }
            }

            // Sync Playlist if active
            if (state.status === "active" || state.status === "online") {
                if (activePlaylistId) {
                    await fetchPlaylist(activePlaylistId);
                } else {
                    state.playlist = [];
                    localStorage.setItem(KEYS.PLAYLIST, '[]');
                }
            }

            if (oldStatus !== state.status) {
                updateUI();
            }
        } catch (err) {
            console.error("Error fetching screen configuration:", err);
            // 5. Offline unpair check (24 hour threshold)
            const lastSync = parseInt(localStorage.getItem('signage_tizen_last_sync') || '0');
            if (lastSync > 0) {
                const durationOffline = Date.now() - lastSync;
                const oneDayMs = 24 * 60 * 60 * 1000;
                if (durationOffline > oneDayMs) {
                    console.warn("Player offline for > 24 hours. Resetting to pairing mode.");
                    disconnectDevice();
                }
            }
        }
    }

    // Check if scheduled time is reached
    function isScheduleDue(scheduleDate, scheduleTime) {
        if (!scheduleDate || !scheduleTime) return false;
        try {
            const scheduled = new Date(`${scheduleDate}T${scheduleTime}`);
            return new Date() >= scheduled;
        } catch (e) {
            console.error("Error comparing schedule time:", e);
            return false;
        }
    }

    // Resolve Scheduled Playlist ID by Name
    async function fetchScheduledPlaylistId(playlistName) {
        try {
            if (playlistName === "Normal" || playlistName === "Unassigned") return "";
            const url = `${POCKETBASE_URL}/api/collections/playlists/records?filter=name%3D%22${encodeURIComponent(playlistName)}%22`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.items && data.items.length > 0) {
                    return data.items[0].id;
                }
            }
        } catch (e) {
            console.error("Failed to query scheduled playlist ID:", e);
        }
        return "";
    }

    // Sync Playlist details
    async function fetchPlaylist(playlistId) {
        try {
            const url = `${POCKETBASE_URL}/api/collections/playlists/records/${playlistId}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Playlist retrieval failed');
            const data = await res.json();

            // Cache Widget details
            state.widget = {
                type: data.widgetType || null,
                placement: data.widgetPlacement || 'top-right',
                link: data.widgetLink || ''
            };
            localStorage.setItem(KEYS.WIDGET, JSON.stringify(state.widget));

            // Sync Playlist assets from slides or direct references
            let fetchedAssets = [];
            
            // 1. Resolve from slides sequence (with custom durations, ordering)
            if (data.slides && data.slides.length > 0) {
                for (const slide of data.slides) {
                    const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${slide.mediaId}`);
                    if (mediaRes.ok) {
                        const media = await mediaRes.json();
                        fetchedAssets.push({
                            id: media.id,
                            url: media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail,
                            mediaType: media.type.toLowerCase(),
                            filename: media.title,
                            duration: slide.duration || media.duration || 10
                        });
                    }
                }
            } 
            // 2. Fallback to assetsJson
            else if (data.assetsJson && data.assetsJson.length > 0) {
                data.assetsJson.forEach((pbAsset) => {
                    fetchedAssets.push({
                        id: pbAsset.id,
                        url: pbAsset.url,
                        mediaType: pbAsset.mediaType.toLowerCase(),
                        filename: pbAsset.filename,
                        duration: pbAsset.duration || 10
                    });
                });
            } 
            // 3. Fallback to native files
            else if (data.files && data.files.length > 0) {
                data.files.forEach((fileName, index) => {
                    fetchedAssets.push({
                        id: `${playlistId}_${index}`,
                        url: `${POCKETBASE_URL}/api/files/playlists/${playlistId}/${fileName}`,
                        mediaType: "image",
                        filename: fileName,
                        duration: 10
                    });
                });
            }
            // 4. Fallback to mediaIds
            else if (data.mediaIds && data.mediaIds.length > 0) {
                for (const mediaId of data.mediaIds) {
                    const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${mediaId}`);
                    if (mediaRes.ok) {
                        const media = await mediaRes.json();
                        fetchedAssets.push({
                            id: media.id,
                            url: media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail,
                            mediaType: media.type.toLowerCase(),
                            filename: media.title,
                            duration: media.duration || 10
                        });
                    }
                }
            }

            // Apply shuffle if the playlist setting is enabled
            if (data.shuffle && fetchedAssets.length > 0) {
                fetchedAssets = fetchedAssets.sort(() => Math.random() - 0.5);
            }

            // Sync transitions and loop flags
            state.playlistTransition = data.transition || 'fade';
            state.playlistLoop = data.loop !== false; // Default to true

            // Check structure equality
            const isDifferent = JSON.stringify(fetchedAssets) !== JSON.stringify(state.playlist);
            if (isDifferent) {
                state.playlist = fetchedAssets;
                localStorage.setItem(KEYS.PLAYLIST, JSON.stringify(state.playlist));
                state.currentAssetIndex = 0;
                updateUI();
            }
        } catch (err) {
            console.error("Error syncing playlist assets:", err);
        }
    }

    // Playback playlist rotation loop
    function startPlaylistRotation() {
        if (rotationTimeout) clearTimeout(rotationTimeout);
        if (!state.playlist || state.playlist.length === 0) return;

        const asset = state.playlist[state.currentAssetIndex];
        if (!asset) {
            state.currentAssetIndex = 0;
            return;
        }

        console.log(`Rotating to asset index ${state.currentAssetIndex}: ${asset.filename} (${asset.mediaType})`);

        // Apply transition styling classes
        views.imagePlayer.style.transition = state.playlistTransition === 'none' ? 'none' : 'opacity 0.5s ease-in-out';
        views.videoPlayer.style.transition = state.playlistTransition === 'none' ? 'none' : 'opacity 0.5s ease-in-out';

        if (asset.mediaType === 'video') {
            views.imagePlayer.style.display = 'none';
            views.videoPlayer.src = asset.url;
            views.videoPlayer.style.display = 'block';
            views.videoPlayer.volume = state.volume / 100;
            views.videoPlayer.play().catch(e => {
                console.warn("Autoplay block / playback error on video", e);
                // Advance automatically if blocked
                rotationTimeout = setTimeout(advancePlaylist, 5000);
            });
        } else {
            views.videoPlayer.style.display = 'none';
            views.videoPlayer.pause();
            views.imagePlayer.src = asset.url;
            views.imagePlayer.style.display = 'block';

            // Image duration rotation
            const duration = (asset.duration || 10) * 1000;
            rotationTimeout = setTimeout(advancePlaylist, duration);
        }
    }

    function advancePlaylist() {
        if (state.playlist.length > 0) {
            // Respect loop settings
            if (state.currentAssetIndex === state.playlist.length - 1 && !state.playlistLoop) {
                console.log("End of playlist reached and loop is disabled. Stopping rotation.");
                return;
            }
            state.currentAssetIndex = (state.currentAssetIndex + 1) % state.playlist.length;
            startPlaylistRotation();
        }
    }

    // Display overlay widgets (QR, clock, weather, RSS news ticker)
    function renderWidgets() {
        const w = state.widget;
        if (!w || !w.type) return;

        console.log("Rendering widget overlay:", w.type, w.placement);

        // Hide all widgets first
        widgets.qrcode.classList.add('hidden');
        widgets.weather.classList.add('hidden');
        widgets.clock.classList.add('hidden');
        widgets.rss.classList.add('hidden');

        // Apply placement class
        const placement = w.placement || 'top-right';
        [widgets.qrcode, widgets.weather, widgets.clock].forEach(el => {
            el.className = 'widget-item ' + (el.id === 'widget-qrcode' ? '' : 'card hud');
            el.classList.add(placement);
        });

        if (w.type === 'qrcode') {
            const link = w.link || SERVER_URL;
            widgets.qrcodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}`;
            widgets.qrcode.classList.remove('hidden');
        } else if (w.type === 'weather') {
            widgets.weather.querySelector('.location-name').innerText = w.link || 'Bengaluru';
            widgets.weather.classList.remove('hidden');
        } else if (w.type === 'clock') {
            widgets.clockTitle.innerText = w.link || 'Lobby Clock';
            widgets.clock.classList.remove('hidden');
        } else if (w.type === 'rss') {
            widgets.rssText.innerText = w.link || 'SignageOS Player online and running.';
            widgets.rss.classList.remove('hidden');
        }
    }

    // Start Clock widget loop
    function startClockWidget() {
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(() => {
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            widgets.clockTime.innerText = timeStr;
        }, 1000);
    }

    // Start periodic background loops
    function startSyncLoops() {
        if (syncInterval) clearInterval(syncInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);

        // Config Sync every 7.5 seconds
        syncInterval = setInterval(() => {
            if (state.screenId) {
                fetchScreenConfig();
            } else if (state.status === 'pairing') {
                checkPairingStatusOnServer();
            }
        }, 7500);

        // Diagnostic heartbeat every 30 seconds
        heartbeatInterval = setInterval(() => {
            sendHeartbeat();
        }, 30000);
    }

    // Query pairing status on server
    async function checkPairingStatusOnServer() {
        if (!state.screenId) return;
        try {
            const url = `${POCKETBASE_URL}/api/collections/screens/records/${state.screenId}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.status && data.status !== 'pairing') {
                    console.log("Device has been successfully paired!");
                    state.status = data.status;
                    localStorage.setItem(KEYS.STATUS, state.status);
                    updateUI();
                }
            }
        } catch (err) {
            console.error("Error checking pairing status:", err);
        }
    }

    // Broadcast diagnostic heartbeat to backend API
    async function sendHeartbeat() {
        if (state.status === 'pairing' || !state.screenId) return;
        try {
            const currentAsset = state.playlist[state.currentAssetIndex];
            const payload = {
                hardwareUuid: state.uuid,
                cpuTemp: 45.0, // Mock temp since we are in sandboxed browser
                currentPlayingAsset: currentAsset ? currentAsset.filename : 'None',
                storageUsedBytes: 15 * 1024 * 1024,
                storageAvailableBytes: 85 * 1024 * 1024
            };

            await fetch(`${SERVER_URL}/api/v1/devices/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error("Heartbeat broadcast failed:", err);
        }
    }

    // Disconnect and reset pairing
    function disconnectDevice() {
        console.log("Disconnecting device and resetting pairing states.");
        localStorage.removeItem(KEYS.SCREEN_ID);
        localStorage.removeItem(KEYS.PAIRING_CODE);
        localStorage.removeItem(KEYS.STATUS);
        localStorage.removeItem(KEYS.PLAYLIST);
        localStorage.removeItem(KEYS.WIDGET);

        state.screenId = '';
        state.pairingCode = '';
        state.status = 'pairing';
        state.playlist = [];
        state.widget = {};

        updateUI();
        requestPairingCode();
    }

    // Report playback logs/errors directly to pocketbase logs collection
    async function reportError(event, detail) {
        if (!state.screenId) return;
        try {
            await fetch(`${POCKETBASE_URL}/api/collections/screen_logs/records`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    screenId: state.screenId,
                    screenName: 'Tizen Player',
                    event: event,
                    detail: detail,
                    type: 'error'
                })
            });
        } catch (err) {
            console.error("Failed to post error logs:", err);
        }
    }

    // Start App
    window.onload = init;
})();
