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
        widget: JSON.parse(localStorage.getItem(KEYS.WIDGET) || '{}'),
        orientation: localStorage.getItem('signage_tizen_orientation') || 'horizontal',
        playlistTransition: localStorage.getItem('signage_tizen_transition') || 'fade',
        playlistLoop: localStorage.getItem('signage_tizen_loop') !== 'false',
        cacheBust: localStorage.getItem('signage_tizen_cache_bust') || '',
        qrcodeLocalPath: localStorage.getItem('signage_qrcode_local_path') || '',
        playlistId: localStorage.getItem('signage_tizen_playlist_id') || '',
        screenUpdated: localStorage.getItem('signage_tizen_screen_updated') || ''
    };

    // Inactivity / Idle Auto Launch Timeout
    let idleTimeout = null;

    // Elements
    const views = {
        splash: document.getElementById('splash-screen'),
        pairing: document.getElementById('pairing-screen'),
        standby: document.getElementById('standby-screen'),
        suspended: document.getElementById('suspended-screen'),
        playback: document.getElementById('playback-screen'),
        outOfRange: document.getElementById('out-of-range-media-placeholder'),
        pairingCodeText: document.getElementById('pairing-code'),
        pairingStatusMsg: document.getElementById('pairing-status-message'),
        refreshCodeBtn: document.getElementById('refresh-code-btn'),
        imagePlayer: document.getElementById('image-player'),
        videoPlayer: document.getElementById('video-player'),
        splashLogo: document.getElementById('splash-logo'),
        pairingLogo: document.getElementById('pairing-logo'),
        standbyLogo: document.getElementById('standby-logo'),
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
        rssText: document.getElementById('rss-text'),
        rssTextDup: document.getElementById('rss-text-dup')
    };

    // Loop Timers
    let rotationTimeout = null;
    let syncInterval = null;
    let heartbeatInterval = null;
    let clockInterval = null;

    // Detect physical screen diagonal and model name to verify size limit (under 43 inches)
    function checkScreenSize() {
        return new Promise((resolve) => {
            // Query parameter override for testing (e.g. ?test_inches=50)
            const urlParams = new URLSearchParams(window.location.search);
            const testInches = urlParams.get('test_inches');
            if (testInches) {
                const inches = parseInt(testInches, 10);
                console.log(`Query parameter test override detected: ${inches} inches`);
                resolve({ allowed: inches <= 43, size: inches });
                return;
            }

            if (!window.tizen || !window.tizen.systeminfo) {
                console.log("Not in Tizen environment, allowing all sizes.");
                resolve({ allowed: true, size: 0 });
                return;
            }

            let detectedInches = null;
            let displayDone = false;
            let buildDone = false;

            function checkDone() {
                if (displayDone && buildDone) {
                    if (detectedInches !== null && detectedInches > 43) {
                        resolve({ allowed: false, size: detectedInches });
                    } else {
                        resolve({ allowed: true, size: detectedInches || 0 });
                    }
                }
            }

            // Method 1: Check DISPLAY physical dimensions
            try {
                window.tizen.systeminfo.getPropertyValue("DISPLAY", (disp) => {
                    if (disp.physicalWidth && disp.physicalHeight) {
                        const widthMm = disp.physicalWidth;
                        const heightMm = disp.physicalHeight;
                        const diagonalMm = Math.sqrt(Math.pow(widthMm, 2) + Math.pow(heightMm, 2));
                        const inches = diagonalMm / 25.4;
                        console.log(`DISPLAY physical diagonal: ${inches.toFixed(2)} inches`);
                        if (inches > 0) {
                            detectedInches = Math.round(inches);
                        }
                    }
                    displayDone = true;
                    checkDone();
                }, (err) => {
                    console.warn("DISPLAY systeminfo fetch error:", err);
                    displayDone = true;
                    checkDone();
                });
            } catch (e) {
                console.error("DISPLAY property access exception:", e);
                displayDone = true;
                checkDone();
            }

            // Method 2: Check BUILD model code for size digits (e.g. QB43C, LH55QB, UN65RU...)
            try {
                window.tizen.systeminfo.getPropertyValue("BUILD", (build) => {
                    if (build.model) {
                        console.log(`BUILD model detected: ${build.model}`);
                        // Find first sequence of two or more digits in the model name
                        const matches = build.model.match(/\d{2,}/);
                        if (matches && matches[0]) {
                            const sizeFromModel = parseInt(matches[0], 10);
                            console.log(`Parsed size from model code: ${sizeFromModel} inches`);
                            if (sizeFromModel > 0 && (!detectedInches || sizeFromModel > detectedInches)) {
                                detectedInches = sizeFromModel;
                            }
                        }
                    }
                    buildDone = true;
                    checkDone();
                }, (err) => {
                    console.warn("BUILD systeminfo fetch error:", err);
                    buildDone = true;
                    checkDone();
                });
            } catch (e) {
                console.error("BUILD property access exception:", e);
                buildDone = true;
                checkDone();
            }
        });
    }

    // Fetch helper with timeout to avoid AbortController incompatibility in Tizen 3.0/4.0
    function fetchWithTimeout(url, options = {}, timeout = 2500) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Request timeout")), timeout);
            })
        ]);
    }

    // Initialize application
    function init() {
        console.log("Initializing SignageOS Tizen App...");
        applyBranding();
        bindEvents();

        // Clear any pending auto-launch alarms (if we just opened)
        cancelAutoLaunchAlarm();

        // Listen for keydown/click to reset the auto-launch idle timer
        window.addEventListener('keydown', resetIdleTimer);
        window.addEventListener('click', resetIdleTimer);

        // Listen for visibility changes (background / exit state)
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // If paired already, immediately query config, else start in pairing mode
        if (state.screenId) {
            POCKETBASE_URL = localStorage.getItem('signage_tizen_pb_url') || POCKETBASE_URL;
            // If we have a cached playlist, hide splash immediately to play cached content offline / without delay
            if (state.playlist && state.playlist.length > 0) {
                views.splash.classList.remove('active');
            }
            fetchScreenConfig().then(() => {
                views.splash.classList.remove('active');
                updateUI();
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

        // Run screen size hardware check in the background (does not block load)
        checkScreenSize().then((result) => {
            state.isOutOfRange = !result.allowed;
            if (state.isOutOfRange) {
                console.warn(`Screen size verification limit reached (${result.size}"). Media content will be blocked.`);
                updateUI();
            }
        });
    }

    // Handle background transition or exit
    function handleVisibilityChange() {
        if (document.hidden) {
            console.log("App moved to background / hidden. Scheduling auto-launch alarm in 15 seconds...");
            scheduleAutoLaunchAlarm();
        } else {
            console.log("App returned to foreground. Cancelling auto-launch alarm and resuming playback...");
            cancelAutoLaunchAlarm();

            // Resume active media and loop
            if (state.status === 'active') {
                try {
                    const currentAsset = state.playlist[state.currentAssetIndex];
                    if (currentAsset && currentAsset.mediaType === 'video') {
                        views.videoPlayer.play().catch(e => console.warn("Failed to resume video on wake:", e));
                    }
                    startPlaylistRotation();
                } catch (err) {
                    console.error("Failed to restore playback state on wake:", err);
                }
            }
        }
    }

    // Schedule Tizen Alarm to launch this app in 15 seconds
    function scheduleAutoLaunchAlarm() {
        try {
            if (window.tizen && window.tizen.alarm && window.tizen.application) {
                const appId = window.tizen.application.getCurrentApplication().appInfo.id;
                
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
                const appId = window.tizen.application.getCurrentApplication().appInfo.id;
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

        // Remote navigation / spatial select support for Tizen TVs
        window.addEventListener('keydown', (e) => {
            const keyCode = e.keyCode;
            const isPairingScreenActive = views.pairing && views.pairing.classList.contains('active');

            if (isPairingScreenActive) {
                // Focus the refresh button on any navigation key press to show visual feedback highlight
                if (document.activeElement !== views.refreshCodeBtn) {
                    views.refreshCodeBtn.focus();
                }

                // If Enter / OK is pressed (Tizen KeyCodes: 13, 29443, 10190)
                if (keyCode === 13 || keyCode === 29443 || keyCode === 10190 || e.key === 'Enter') {
                    e.preventDefault();
                    views.refreshCodeBtn.click();
                }
            }
        });

        // Loop next media on video end
        // Disabled to strictly respect custom slide durations rather than video length
        // views.videoPlayer.addEventListener('ended', () => {
        //     console.log("Video playback complete, advancing index.");
        //     advancePlaylist();
        // });

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
        const defaultLogo = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230ea5e9'><path d='M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z'/></svg>";
        const logoUrl = (state.branding && state.branding.isWhiteLabel && state.branding.logoUrl) 
            ? state.branding.logoUrl 
            : defaultLogo;

        if (views.splashLogo) views.splashLogo.src = logoUrl;
        if (views.pairingLogo) views.pairingLogo.src = logoUrl;
        if (views.standbyLogo) views.standbyLogo.src = logoUrl;

        if (state.branding && state.branding.isWhiteLabel && state.branding.name) {
            if (views.splashName) views.splashName.innerText = state.branding.name;
            const standbyTitle = document.getElementById('standby-title');
            const standbyDesc = document.getElementById('standby-desc');
            if (standbyTitle) standbyTitle.innerText = `READY FOR ${state.branding.name.toUpperCase()} CONTENT`;
            if (standbyDesc) standbyDesc.innerText = "Assign playlist from Whitelabel CMS Portal.";
        } else {
            const standbyTitle = document.getElementById('standby-title');
            const standbyDesc = document.getElementById('standby-desc');
            if (standbyTitle) standbyTitle.innerText = "Standby Mode";
            if (standbyDesc) standbyDesc.innerText = "No playlist assigned to this screen. Please assign a playlist from the SignageOS Dashboard.";
        }
    }

    // Apply orientation rotation CSS class
    function applyOrientation() {
        const orientation = state.orientation || 'horizontal';
        if (orientation === 'vertical' && window.innerWidth > window.innerHeight) {
            views.playback.classList.add('rotate-portrait');
        } else {
            views.playback.classList.remove('rotate-portrait');
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
                resetIdleTimer();
                break;
            case 'suspended':
                views.suspended.classList.add('active');
                break;
            case 'active':
            case 'online':
            case 'offline':
                if (idleTimeout) {
                    clearTimeout(idleTimeout);
                    idleTimeout = null;
                }
                if (!state.playlist || state.playlist.length === 0) {
                    views.standby.classList.add('active');
                } else {
                    applyOrientation();
                    views.playback.classList.add('active');
                    startPlaylistRotation();
                    renderWidgets();
                }
                break;
            default:
                views.pairing.classList.add('active');
                resetIdleTimer();
                break;
        }
    }

    // Reset inactivity / idle auto launch timer
    function resetIdleTimer() {
        if (idleTimeout) clearTimeout(idleTimeout);

        // Auto-launch playlist if device is already paired and has slides
        if (state.playlist && state.playlist.length > 0 && state.status !== 'active' && state.status !== 'online' && state.status !== 'offline' && state.status !== 'suspended') {
            console.log("Inactivity timer started. Auto-launching in 2 minutes.");
            idleTimeout = setTimeout(() => {
                console.log("Inactivity timeout: launching playlist full screen.");
                state.status = 'active';
                localStorage.setItem(KEYS.STATUS, 'active');
                updateUI();
            }, 120000);
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
        if (window.navigator && window.navigator.onLine === false) {
            console.log("Device is offline. Skipping sync check.");
            return;
        }

        try {
            const url = `${POCKETBASE_URL}/api/collections/screens/records/${state.screenId}`;
            const res = await fetchWithTimeout(url, {}, 2500);
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
            
            let hasChanged = false;

            // Check status transition
            const oldStatus = state.status;
            const oldVolume = state.volume;
            state.status = data.status || 'pairing';
            state.volume = data.volume || 80;

            if (oldStatus !== state.status || oldVolume !== state.volume) {
                hasChanged = true;
                localStorage.setItem(KEYS.STATUS, state.status);
                localStorage.setItem(KEYS.VOLUME, state.volume);
            }

            // Sync branding
            const oldBranding = JSON.stringify(state.branding);
            state.branding = {
                isWhiteLabel: !!data.whiteLabel,
                logoUrl: data.websiteLogo || '',
                name: data.websiteName || ''
            };
            if (oldBranding !== JSON.stringify(state.branding)) {
                hasChanged = true;
                localStorage.setItem(KEYS.BRANDING, JSON.stringify(state.branding));
                applyBranding();
            }

            // 1. Clear Cache commands
            if (data.clear_cache) {
                console.log("Received clear cache instruction.");
                state.cacheBust = Date.now().toString();
                localStorage.setItem('signage_tizen_cache_bust', state.cacheBust);
                localStorage.removeItem(KEYS.PLAYLIST);
                state.playlist = [];
                hasChanged = true;
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
                state.cacheBust = Date.now().toString();
                localStorage.setItem('signage_tizen_cache_bust', state.cacheBust);
                localStorage.removeItem(KEYS.PLAYLIST);
                state.playlist = [];
                state.currentAssetIndex = 0;
                hasChanged = true;
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
                hasChanged = true;
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
                        hasChanged = true;
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

            // Sync Playlist if active and changed
            if (state.status === "active" || state.status === "online") {
                if (activePlaylistId) {
                    const screenUpdated = data.updated;
                    const hasPlaylistChanged = activePlaylistId !== state.playlistId;
                    const hasScreenUpdated = screenUpdated !== state.screenUpdated;
                    const isPlaylistEmpty = !state.playlist || state.playlist.length === 0;

                    if (hasPlaylistChanged || hasScreenUpdated || isPlaylistEmpty) {
                        console.log(`Syncing playlist. Reason: playlistChanged=${hasPlaylistChanged}, screenUpdated=${hasScreenUpdated}, isEmpty=${isPlaylistEmpty}`);
                        state.playlistId = activePlaylistId;
                        state.screenUpdated = screenUpdated;
                        localStorage.setItem('signage_tizen_playlist_id', state.playlistId);
                        localStorage.setItem('signage_tizen_screen_updated', state.screenUpdated);
                        await fetchPlaylist(activePlaylistId);
                        hasChanged = true;
                    }
                } else {
                    if (state.playlistId || state.playlist.length > 0) {
                        state.playlist = [];
                        state.playlistId = '';
                        state.screenUpdated = '';
                        localStorage.setItem(KEYS.PLAYLIST, '[]');
                        localStorage.removeItem('signage_tizen_playlist_id');
                        localStorage.removeItem('signage_tizen_screen_updated');
                        hasChanged = true;
                    }
                }
            }

            if (hasChanged) {
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

            // Check if playlist updated timestamp actually changed!
            const lastUpdated = data.updated;
            const cachedPlaylistUpdated = localStorage.getItem('signage_tizen_playlist_updated') || '';
            const isPlaylistEmpty = !state.playlist || state.playlist.length === 0;

            if (lastUpdated === cachedPlaylistUpdated && !isPlaylistEmpty) {
                console.log("Playlist content timestamp is unchanged. Skipping media item fetch and file sync.");
                return;
            }

            // Sync Playlist assets from slides or direct references
            let fetchedAssets = [];
            
            // 1. Resolve from slides sequence (with custom durations, ordering)
            let slides = data.slides || [];
            if (typeof slides === 'string') {
                try {
                    slides = JSON.parse(slides);
                } catch (e) {
                    console.error("Failed to parse slides JSON string:", e);
                    slides = [];
                }
            }

            if (Array.isArray(slides) && slides.length > 0) {
                for (const slide of slides) {
                    const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${slide.mediaId}`);
                    if (mediaRes.ok) {
                        const media = await mediaRes.json();
                        const rawUrl = media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail;
                        fetchedAssets.push({
                            id: media.id,
                            url: rawUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                            mediaType: media.type.toLowerCase(),
                            filename: media.title,
                            duration: parseInt(slide.duration || media.duration || 10, 10),
                            thumbnail: media.thumbnail || rawUrl,
                            objectFit: slide.objectFit || 'cover',
                            scalePercent: slide.scalePercent || 100
                        });
                    }
                }
            } 
            // 2. Fallback to assetsJson
            else if (data.assetsJson && data.assetsJson.length > 0) {
                data.assetsJson.forEach((pbAsset) => {
                    fetchedAssets.push({
                        id: pbAsset.id,
                        url: pbAsset.url + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                        mediaType: pbAsset.mediaType.toLowerCase(),
                        filename: pbAsset.filename,
                        duration: pbAsset.duration || 10,
                        thumbnail: pbAsset.thumbnail || pbAsset.url,
                        objectFit: pbAsset.objectFit || 'cover',
                        scalePercent: pbAsset.scalePercent || 100
                    });
                });
            } 
            // 3. Fallback to native files
            else if (data.files && data.files.length > 0) {
                data.files.forEach((fileName, index) => {
                    const rawUrl = `${POCKETBASE_URL}/api/files/playlists/${playlistId}/${fileName}`;
                    fetchedAssets.push({
                        id: `${playlistId}_${index}`,
                        url: rawUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                        mediaType: "image",
                        filename: fileName,
                        duration: 10,
                        thumbnail: rawUrl,
                        objectFit: 'cover',
                        scalePercent: 100
                    });
                });
            }
            // 4. Fallback to mediaIds
            else if (data.mediaIds && data.mediaIds.length > 0) {
                for (const mediaId of data.mediaIds) {
                    const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${mediaId}`);
                    if (mediaRes.ok) {
                        const media = await mediaRes.json();
                        const rawUrl = media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail;
                        fetchedAssets.push({
                            id: media.id,
                            url: rawUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                            mediaType: media.type.toLowerCase(),
                            filename: media.title,
                            duration: media.duration || 10,
                            thumbnail: media.thumbnail || rawUrl,
                            objectFit: 'cover',
                            scalePercent: 100
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
            state.orientation = data.orientation || 'horizontal';

            localStorage.setItem('signage_tizen_transition', state.playlistTransition);
            localStorage.setItem('signage_tizen_loop', state.playlistLoop);
            localStorage.setItem('signage_tizen_orientation', state.orientation);

            applyOrientation();

            // Check structural changes using media IDs and ordering
            const newKeys = fetchedAssets.map(a => `${a.id}_${a.duration}`);
            const currentKeys = state.playlist.map(a => `${a.id}_${a.duration}`);
            const isDifferent = JSON.stringify(newKeys) !== JSON.stringify(currentKeys);
            if (isDifferent) {
                state.playlist = fetchedAssets;
                localStorage.setItem(KEYS.PLAYLIST, JSON.stringify(state.playlist));
                state.currentAssetIndex = 0;
                updateUI();
            }

            // Sync files to TV internal storage in the background for future offline playback
            syncLocalFiles(fetchedAssets.map(a => Object.assign({}, a))).then((localAssets) => {
                const hasLocalChanges = JSON.stringify(localAssets) !== JSON.stringify(state.playlist);
                if (hasLocalChanges) {
                    console.log("Background local storage sync finished. Updated assets list silently.");
                    state.playlist = localAssets;
                    localStorage.setItem(KEYS.PLAYLIST, JSON.stringify(state.playlist));
                }
            }).catch((syncErr) => {
                console.error("Background local file sync failed:", syncErr);
            });

            localStorage.setItem('signage_tizen_playlist_updated', lastUpdated);
        } catch (err) {
            console.error("Error syncing playlist assets:", err);
        }
    }

    // Offline caching: sync remote files to local Tizen filesystem storage
    async function syncLocalFiles(assets) {
        if (!window.tizen || !window.tizen.filesystem) {
            console.log("Not running on Tizen screen. Skipping offline local filesystem sync.");
            return assets;
        }

        try {
            const dir = await new Promise((resolve, reject) => {
                window.tizen.filesystem.resolve("wgt-private", resolve, reject, "rw");
            });

            console.log("Local wgt-private storage resolved. Syncing assets...");

            // Process all media items sequentially
            for (let i = 0; i < assets.length; i++) {
                const asset = assets[i];
                if (!asset.url) continue;

                // Determine file extension
                let ext = 'png';
                if (asset.mediaType === 'video') ext = 'mp4';
                else if (asset.url.includes('.gif')) ext = 'gif';
                else if (asset.url.includes('.jpg') || asset.url.includes('.jpeg')) ext = 'jpg';
                else if (asset.url.includes('.webp')) ext = 'webp';

                const filename = `asset_${asset.id}.${ext}`;

                try {
                    // Check if file exists locally
                    const file = dir.resolve(filename);
                    console.log(`Asset ${filename} already exists locally: ${file.toURI()}`);
                    asset.url = file.toURI(); // Replace remote URL with local URI
                } catch (e) {
                    // File does not exist, download it via fetch to follow redirects (S3/R2 compatibility)
                    console.log(`Downloading asset: ${asset.url} as ${filename}`);
                    
                    try {
                        let response;
                        try {
                            response = await fetch(asset.url);
                            if (!response.ok) throw new Error("Direct fetch failed");
                        } catch (directErr) {
                            console.log(`Direct download failed (possibly CORS). Trying proxy: ${asset.url}`);
                            const proxyUrl = `${SERVER_URL}/api/v1/public/proxy-media?url=${encodeURIComponent(asset.url)}`;
                            response = await fetch(proxyUrl);
                            if (!response.ok) throw new Error("Proxy download failed");
                        }
                        const blob = await response.blob();

                        // Convert blob to base64
                        const base64Data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64 = reader.result.split(',')[1];
                                resolve(base64);
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });

                        // Write Base64 data to local file using compatible Tizen FileStream APIs
                        const file = dir.createFile(filename);
                        await new Promise((resolve, reject) => {
                            file.openStream("w", (stream) => {
                                try {
                                    if (typeof stream.writeBase64 === 'function') {
                                        stream.writeBase64(base64Data);
                                    } else if (typeof stream.writeData === 'function') {
                                        const binaryString = window.atob(base64Data);
                                        const len = binaryString.length;
                                        const bytes = new Uint8Array(len);
                                        for (let j = 0; j < len; j++) {
                                            bytes[j] = binaryString.charCodeAt(j);
                                        }
                                        stream.writeData(bytes);
                                    } else {
                                        stream.write(base64Data);
                                    }
                                    stream.close();
                                    resolve();
                                } catch (writeErr) {
                                    stream.close();
                                    reject(writeErr);
                                }
                            }, reject);
                        });

                        console.log(`Successfully cached asset ${filename} locally.`);
                        asset.url = file.toURI();
                    } catch (dlErr) {
                        console.error(`Failed to download and write asset ${filename}:`, dlErr);
                    }
                }
            }

            // Sync QR Code Widget locally if active
            const w = state.widget;
            const activeTypes = w && w.type ? w.type.split(',').map(s => s.trim().toLowerCase()) : [];
            if (activeTypes.includes('qrcode') && w.link) {
                let qrcodeLink = w.link;
                if (w.link.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(w.link);
                        if (parsed.qrcode) qrcodeLink = parsed.qrcode;
                    } catch (e) {}
                }
                
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrcodeLink)}`;
                const safeUrlStr = qrcodeLink.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
                const qrFilename = `qrcode_${safeUrlStr}.png`;

                try {
                    // Check if file exists locally
                    const file = dir.resolve(qrFilename);
                    state.qrcodeLocalPath = file.toURI();
                    localStorage.setItem('signage_qrcode_local_path', state.qrcodeLocalPath);
                } catch (e) {
                    console.log(`Downloading updated QR code image: ${qrFilename}`);
                    try {
                        const response = await fetch(qrUrl);
                        if (!response.ok) throw new Error("QR network fetch failed");
                        const blob = await response.blob();
                        const base64Data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });

                        const file = dir.createFile(qrFilename);
                        await new Promise((resolve, reject) => {
                            file.openStream("w", (stream) => {
                                try {
                                    if (typeof stream.writeBase64 === 'function') {
                                        stream.writeBase64(base64Data);
                                    } else if (typeof stream.writeData === 'function') {
                                        const binaryString = window.atob(base64Data);
                                        const len = binaryString.length;
                                        const bytes = new Uint8Array(len);
                                        for (let j = 0; j < len; j++) {
                                            bytes[j] = binaryString.charCodeAt(j);
                                        }
                                        stream.writeData(bytes);
                                    } else {
                                        stream.write(base64Data);
                                    }
                                    stream.close();
                                    resolve();
                                } catch (writeErr) {
                                    stream.close();
                                    reject(writeErr);
                                }
                            }, reject);
                        });

                        state.qrcodeLocalPath = file.toURI();
                        localStorage.setItem('signage_qrcode_local_path', state.qrcodeLocalPath);
                    } catch (qrErr) {
                        console.error("QR Code offline download failed:", qrErr);
                    }
                }
            }

        } catch (err) {
            console.error("Local filesystem synchronization failed:", err);
        }

        return assets;
    }

    // Playback playlist rotation loop
    function startPlaylistRotation() {
        if (rotationTimeout) clearTimeout(rotationTimeout);
        if (!state.playlist || state.playlist.length === 0) return;

        const asset = state.playlist[state.currentAssetIndex];
        if (!asset) {
            console.warn(`Asset at index ${state.currentAssetIndex} is undefined. Resetting to index 0.`);
            state.currentAssetIndex = 0;
            if (state.playlist && state.playlist[0]) {
                startPlaylistRotation();
            }
            return;
        }

        console.log(`Rotating to asset index ${state.currentAssetIndex}: ${asset.filename} (${asset.mediaType})`);
 
        // If device is out of range, replace background media with placeholder but continue loop
        if (state.isOutOfRange) {
            views.imagePlayer.style.display = 'none';
            views.videoPlayer.style.display = 'none';
            views.videoPlayer.pause();
            if (views.outOfRange) {
                views.outOfRange.style.display = 'flex';
            }
            const duration = (asset.duration || 10) * 1000;
            rotationTimeout = setTimeout(advancePlaylist, duration);
            return;
        }

        // Hide out of range placeholder if allowed size
        if (views.outOfRange) {
            views.outOfRange.style.display = 'none';
        }

        // Get transition styling animations
        const transitionName = state.playlistTransition || 'fade';
        const animClass = 'animate-' + (
            transitionName === 'slide' ? 'slideIn' :
            transitionName === 'zoom' ? 'zoomIn' :
            transitionName === 'slide-up' ? 'slideUp' :
            transitionName === 'slide-down' ? 'slideDown' :
            transitionName === 'blur' ? 'blurIn' :
            transitionName === 'bounce' ? 'bounceIn' : 'fadeIn'
        );

        if (asset.mediaType === 'video') {
            // Apply scale mode configuration
            views.videoPlayer.style.objectFit = asset.objectFit || 'cover';
            views.imagePlayer.style.objectFit = asset.objectFit || 'cover';

            // Apply scale zoom configuration
            const scale = asset.scalePercent ? `scale(${asset.scalePercent / 100})` : 'scale(1)';
            views.videoPlayer.style.transform = scale;
            views.imagePlayer.style.transform = scale;

            // Show video thumbnail on the image player during buffering to avoid blank black screen
            if (asset.thumbnail) {
                views.imagePlayer.className = 'media-element';
                views.imagePlayer.src = asset.thumbnail;
                views.imagePlayer.style.display = 'block';
            }

            views.videoPlayer.style.opacity = '0';
            views.videoPlayer.style.display = 'block';
            views.videoPlayer.src = asset.url;
            views.videoPlayer.volume = state.volume / 100;

            const handleVideoPlaying = () => {
                views.videoPlayer.className = 'media-element';
                void views.videoPlayer.offsetWidth; // trigger reflow
                if (transitionName !== 'none') {
                    views.videoPlayer.classList.add(animClass);
                }
                views.videoPlayer.style.opacity = '1';
                views.imagePlayer.style.display = 'none';
                views.videoPlayer.removeEventListener('playing', handleVideoPlaying);
            };
            views.videoPlayer.addEventListener('playing', handleVideoPlaying);

            views.videoPlayer.play().then(() => {
                // Set rotation timeout to cut off video when the slide duration completes
                const duration = (parseInt(asset.duration, 10) || 10) * 1000;
                rotationTimeout = setTimeout(() => {
                    views.videoPlayer.pause();
                    advancePlaylist();
                }, duration);
            }).catch(e => {
                console.warn("Autoplay block / playback error on video", e);
                views.videoPlayer.removeEventListener('playing', handleVideoPlaying);
                // Advance automatically if blocked
                rotationTimeout = setTimeout(advancePlaylist, 5000);
            });
        } else {
            views.videoPlayer.style.display = 'none';
            views.videoPlayer.pause();
            
            // Apply scale mode configuration
            views.imagePlayer.style.objectFit = asset.objectFit || 'cover';

            // Apply scale zoom configuration
            const scale = asset.scalePercent ? `scale(${asset.scalePercent / 100})` : 'scale(1)';
            views.imagePlayer.style.transform = scale;

            // Set source and reset class
            views.imagePlayer.className = 'media-element';
            views.imagePlayer.src = asset.url;
            views.imagePlayer.style.display = 'block';

            // Trigger animation reflow precisely
            void views.imagePlayer.offsetWidth;
            if (transitionName !== 'none') {
                views.imagePlayer.classList.add(animClass);
            }

            // Schedule the transition timeout immediately
            const duration = (parseInt(asset.duration, 10) || 10) * 1000;
            rotationTimeout = setTimeout(advancePlaylist, duration);
        }
    }

    function advancePlaylist() {
        if (rotationTimeout) clearTimeout(rotationTimeout);
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

        // Split active types (e.g. "rss,qrcode")
        const activeTypes = w.type.split(',').map(s => s.trim().toLowerCase());

        // Hide all widgets first by default and apply placement
        const placement = w.placement || 'top-right';
        [widgets.qrcode, widgets.weather, widgets.clock].forEach(el => {
            el.className = 'widget-item ' + (el.id === 'widget-qrcode' ? '' : 'card hud') + ' ' + placement + ' hidden';
        });
        widgets.rss.className = 'rss-ticker-container hidden';

        // Parse individual links from multi-link JSON configuration if present
        let qrcodeLink = w.link;
        let rssLink = w.link;
        let weatherLink = w.link;
        let clockLink = w.link;

        if (w.link && w.link.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(w.link);
                if (parsed.qrcode) qrcodeLink = parsed.qrcode;
                if (parsed.rss) rssLink = typeof parsed.rss === 'object' ? JSON.stringify(parsed.rss) : parsed.rss;
                if (parsed.weather) weatherLink = parsed.weather;
                if (parsed.clock) clockLink = parsed.clock;
            } catch (e) {
                console.warn("Could not parse widget multi-link JSON:", e);
            }
        }

        // Render QR Code widget
        if (activeTypes.includes('qrcode')) {
            const link = qrcodeLink || SERVER_URL;
            widgets.qrcodeImg.src = state.qrcodeLocalPath || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}`;
            widgets.qrcode.className = 'widget-item ' + placement;
            widgets.qrcode.classList.remove('hidden');
        }

        // Render Weather widget
        if (activeTypes.includes('weather')) {
            widgets.weather.className = 'widget-item card hud ' + placement;
            widgets.weather.querySelector('.location-name').innerText = weatherLink || 'Bengaluru';
            widgets.weather.classList.remove('hidden');
        }

        // Render Clock widget
        if (activeTypes.includes('clock')) {
            widgets.clock.className = 'widget-item card hud ' + placement;
            widgets.clockTitle.innerText = clockLink || 'Lobby Clock';
            widgets.clock.classList.remove('hidden');
        }

        // Render RSS News Ticker widget
        if (activeTypes.includes('rss')) {
            let tickerText = rssLink || 'SignageOS Player online and running.';
            let labelText = '';
            let bgColor = '#ffffff';
            let textColor = '#1e293b';

            try {
                const config = JSON.parse(rssLink);
                if (config && typeof config === 'object') {
                    if (config.label) labelText = config.label;
                    if (Array.isArray(config.items)) {
                        tickerText = config.items.filter(item => item && item.trim() !== '').join(' | ');
                    }
                    if (config.bgColor) bgColor = config.bgColor;
                    if (config.textColor) textColor = config.textColor;
                }
            } catch (e) {
                // Not JSON, format plain text with space-pipe-space separator if pipes are present
                if (typeof rssLink === 'string') {
                    tickerText = rssLink.split('|').map(s => s.trim()).filter(Boolean).join(' | ');
                }
            }

            const rssLabelEl = widgets.rss.querySelector('.rss-label');
            if (rssLabelEl) {
                if (labelText && labelText.trim() !== '') {
                    rssLabelEl.innerText = labelText;
                    rssLabelEl.style.display = 'block';
                } else {
                    rssLabelEl.style.display = 'none';
                }
            }
            widgets.rssText.innerText = tickerText;
            if (widgets.rssTextDup) {
                widgets.rssTextDup.innerText = tickerText;
                widgets.rssTextDup.style.color = textColor;
            }
            widgets.rss.style.backgroundColor = bgColor;
            widgets.rssText.style.color = textColor;
            widgets.rss.className = 'rss-ticker-container'; // Make visible (removed hidden)

            // Force animation reflow for Tizen to prevent freeze / stop scrolling
            widgets.rssText.style.animation = 'none';
            if (widgets.rssTextDup) widgets.rssTextDup.style.animation = 'none';
            void widgets.rssText.offsetHeight; // trigger reflow
            widgets.rssText.style.animation = '';
            if (widgets.rssTextDup) widgets.rssTextDup.style.animation = '';
        }
    }

    // Start Clock widget loop
    function startClockWidget() {
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(() => {
            const now = new Date();
            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            const timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
            widgets.clockTime.innerText = timeStr;
        }, 1000);
    }

    // Start periodic background loops
    function startSyncLoops() {
        if (syncInterval) clearInterval(syncInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);

        // Config Sync every 60 seconds (1 minute)
        syncInterval = setInterval(() => {
            if (state.screenId) {
                fetchScreenConfig();
            } else if (state.status === 'pairing') {
                checkPairingStatusOnServer();
            }
        }, 60000);

        // Diagnostic heartbeat every 30 seconds
        heartbeatInterval = setInterval(() => {
            sendHeartbeat();
        }, 30000);
    }

    // Query pairing status on server
    async function checkPairingStatusOnServer() {
        if (!state.screenId) return;
        if (window.navigator && window.navigator.onLine === false) return;

        try {
            const url = `${POCKETBASE_URL}/api/collections/screens/records/${state.screenId}`;
            const res = await fetchWithTimeout(url, {}, 2500);
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
        if (window.navigator && window.navigator.onLine === false) return;

        try {
            const currentAsset = state.playlist[state.currentAssetIndex];
            const payload = {
                hardwareUuid: state.uuid,
                cpuTemp: 45.0, // Mock temp since we are in sandboxed browser
                currentPlayingAsset: currentAsset ? currentAsset.filename : 'None',
                storageUsedBytes: 15 * 1024 * 1024,
                storageAvailableBytes: 85 * 1024 * 1024
            };

            await fetchWithTimeout(`${SERVER_URL}/api/v1/devices/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }, 2500);
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
