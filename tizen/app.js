/**
 * SignageOS Player - Tizen Web Client Engine
 * Complete refactored architecture aligned with Android tv-signage-player repository.
 */

(function () {
    // Config Constants & Server Endpoints
    let SERVER_URL = localStorage.getItem('signage_tizen_server_url') || 'https://dem1.manve.co';
    let POCKETBASE_URL = localStorage.getItem('signage_tizen_pb_url') || 'https://demo.manve.co';

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

    // Application State Variables
    let state = {
        uuid: getOrGenerateUUID(),
        screenId: localStorage.getItem(KEYS.SCREEN_ID) || '',
        pairingCode: localStorage.getItem(KEYS.PAIRING_CODE) || '',
        status: localStorage.getItem(KEYS.STATUS) || 'pairing',
        playlist: JSON.parse(localStorage.getItem(KEYS.PLAYLIST) || '[]'),
        currentAssetIndex: 0,
        volume: parseInt(localStorage.getItem(KEYS.VOLUME) || '80', 10),
        branding: JSON.parse(localStorage.getItem(KEYS.BRANDING) || '{}'),
        widget: JSON.parse(localStorage.getItem(KEYS.WIDGET) || '{}'),
        orientation: localStorage.getItem('signage_tizen_orientation') || 'horizontal',
        playlistTransition: localStorage.getItem('signage_tizen_transition') || 'fade',
        playlistLoop: localStorage.getItem('signage_tizen_loop') !== 'false',
        cacheBust: localStorage.getItem('signage_tizen_cache_bust') || '',
        qrcodeLocalPath: localStorage.getItem('signage_qrcode_local_path') || '',
        playlistId: localStorage.getItem('signage_tizen_playlist_id') || '',
        screenUpdated: localStorage.getItem('signage_tizen_screen_updated') || '',
        lastSyncedAt: parseInt(localStorage.getItem('signage_tizen_last_sync') || '0', 10),
        isOutOfRange: false,
        imageElementsCache: {}
    };

    // Auto-launch & Idle Timer
    let idleTimeout = null;

    // DOM Element Registries
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
        imagePlayer1: document.getElementById('image-player-1'),
        imagePlayer2: document.getElementById('image-player-2'),
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

    // Loop Timers & Double Buffering State
    let rotationTimeout = null;
    let rotationToken = 0;
    let activeImagePlayerNum = 1;
    let syncInterval = null;
    let heartbeatInterval = null;
    let clockInterval = null;

    // Retrieve or generate persistent hardware UUID
    function getOrGenerateUUID() {
        let uuid = localStorage.getItem(KEYS.UUID);
        if (!uuid) {
            uuid = 'tizen-uuid-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem(KEYS.UUID, uuid);
        }
        return uuid;
    }

    // Fetch helper with AbortController timeout to immediately release browser sockets in Tizen
    function fetchWithTimeout(url, options = {}, timeout = 5000) {
        if (typeof window.AbortController === 'function') {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
            const mergedOptions = Object.assign({}, options, { signal: controller.signal });
            return fetch(url, mergedOptions).finally(() => clearTimeout(timer));
        }
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Request timeout")), timeout);
            })
        ]);
    }

    // Resolve file URI safely (handles method vs property across Tizen versions)
    function getFileURI(file) {
        if (file) {
            if (typeof file.toURI === 'function') {
                return file.toURI();
            } else if (typeof file.toURI === 'string') {
                return file.toURI;
            }
        }
        return '';
    }

    // Verify physical screen diagonal size (limit under 43 inches)
    function checkScreenSize() {
        return new Promise((resolve) => {
            const urlParams = new URLSearchParams(window.location.search);
            const testInches = urlParams.get('test_inches');
            if (testInches) {
                const inches = parseInt(testInches, 10);
                resolve({ allowed: inches <= 43, size: inches });
                return;
            }

            try {
                if (window.tizen && window.tizen.systeminfo) {
                    window.tizen.systeminfo.getPropertyValue('DISPLAY', (display) => {
                        const diagonalInches = Math.round(display.diagonalSize || 0);
                        if (diagonalInches > 0) {
                            resolve({ allowed: diagonalInches <= 43, size: diagonalInches });
                        } else {
                            resolve({ allowed: true, size: 0 });
                        }
                    }, () => resolve({ allowed: true, size: 0 }));
                } else {
                    resolve({ allowed: true, size: 0 });
                }
            } catch (e) {
                resolve({ allowed: true, size: 0 });
            }
        });
    }

    // Initialize application
    function init() {
        console.log("Initializing SignageOS Tizen App...");
        applyBranding();
        bindEvents();

        // Clear any pending auto-launch alarms
        cancelAutoLaunchAlarm();

        // Event listeners for resetting auto-launch idle timer
        window.addEventListener('keydown', resetIdleTimer);
        window.addEventListener('click', resetIdleTimer);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // If paired already, immediately fetch screen config and start, else request pairing code
        if (state.screenId) {
            POCKETBASE_URL = localStorage.getItem('signage_tizen_pb_url') || POCKETBASE_URL;
            SERVER_URL = localStorage.getItem('signage_tizen_server_url') || SERVER_URL;

            if (state.playlist && state.playlist.length > 0) {
                views.splash.classList.remove('active');
            }
            fetchScreenConfig().then(() => {
                views.splash.classList.remove('active');
                updateUI();
            });
        } else {
            requestPairingCode().then(() => {
                views.splash.classList.remove('active');
            });
        }

        // Start periodic sync and diagnostic heartbeat loops
        startSyncLoops();
        startClockWidget();

        // Hardware screen size check in background
        checkScreenSize().then((result) => {
            state.isOutOfRange = !result.allowed;
            if (state.isOutOfRange) {
                console.warn(`Screen size verification limit reached (${result.size}"). Media content will be blocked.`);
                updateUI();
            }
        });
    }

    // Bind event listeners
    function bindEvents() {
        if (views.refreshCodeBtn) {
            views.refreshCodeBtn.addEventListener('click', () => {
                views.pairingStatusMsg.innerText = "Requesting new code...";
                requestPairingCode();
            });
        }

        if (views.videoPlayer) {
            views.videoPlayer.addEventListener('error', (e) => {
                console.error("Video element error, skipping asset.", e);
                reportError('Video playback error', e.message || 'unknown');
                sendHeartbeat('Playback error');
                if (rotationTimeout) {
                    clearTimeout(rotationTimeout);
                    rotationTimeout = null;
                }
                advancePlaylist();
            });
        }
    }

    // Handle background transition or exit
    function handleVisibilityChange() {
        if (document.hidden) {
            console.log("App moved to background. Scheduling auto-launch alarm in 15 seconds...");
            scheduleAutoLaunchAlarm();
        } else {
            console.log("App returned to foreground. Cancelling auto-launch alarm and resuming playback...");
            cancelAutoLaunchAlarm();
            if (state.status === 'active' || state.status === 'online') {
                updateUI();
                if (views.videoPlayer && views.videoPlayer.style.display !== 'none' && views.videoPlayer.paused) {
                    views.videoPlayer.play().catch(e => console.warn("Failed to resume video on wake:", e));
                }
            }
        }
    }

    // Reset inactivity timer
    function resetIdleTimer() {
        if (idleTimeout) clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
            if (state.status === 'active' || state.status === 'online') {
                updateUI();
            }
        }, 120000);
    }

    // Schedule SSSP alarm to automatically relaunch app
    function scheduleAutoLaunchAlarm() {
        try {
            if (window.tizen && window.tizen.alarm) {
                const alarm = new window.tizen.alarm.AlarmRelative(15);
                window.tizen.alarm.add(alarm, window.tizen.application.getCurrentApplication().appInfo.id);
                console.log("Auto-launch alarm scheduled in 15 seconds.");
            }
        } catch (e) {
            console.error("Failed to schedule auto-launch alarm:", e);
        }
    }

    // Cancel pending auto-launch alarms
    function cancelAutoLaunchAlarm() {
        try {
            if (window.tizen && window.tizen.alarm) {
                window.tizen.alarm.removeAll();
                console.log("Cleared pending auto-launch alarms.");
            }
        } catch (e) {
            console.error("Failed to clear auto-launch alarms:", e);
        }
    }

    // Apply branding settings
    function applyBranding() {
        const b = state.branding;
        const logoUrl = (b.isWhiteLabel && b.logoUrl) ? b.logoUrl : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&auto=format&fit=crop&q=60';
        const appName = (b.isWhiteLabel && b.name) ? b.name : 'SignageOS';

        if (views.splashLogo) views.splashLogo.src = logoUrl;
        if (views.pairingLogo) views.pairingLogo.src = logoUrl;
        if (views.standbyLogo) views.standbyLogo.src = logoUrl;
        if (views.splashName) views.splashName.innerText = appName;
    }

    // Apply orientation transforms (horizontal vs vertical/portrait)
    function applyOrientation() {
        const isVertical = state.orientation === 'vertical' || state.orientation === 'portrait';
        const body = document.body;

        if (isVertical) {
            body.classList.add('portrait-mode');
        } else {
            body.classList.remove('portrait-mode');
        }
    }

    // Update UI View Controllers based on state.status
    function updateUI() {
        applyOrientation();

        // Hide all primary views
        views.pairing.classList.remove('active');
        views.standby.classList.remove('active');
        views.suspended.classList.remove('active');
        views.playback.classList.remove('active');

        switch (state.status) {
            case 'pairing':
                views.pairing.classList.add('active');
                views.pairingCodeText.innerText = state.pairingCode || '------';
                break;
            case 'suspended':
                views.suspended.classList.add('active');
                break;
            case 'standby':
                views.standby.classList.add('active');
                break;
            case 'active':
            case 'online':
            case 'offline':
                if (!state.playlist || state.playlist.length === 0) {
                    views.standby.classList.add('active');
                } else {
                    views.playback.classList.add('active');
                    syncWidgets();
                    startPlaylistRotation();
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
            const res = await fetchWithTimeout(`${SERVER_URL}/api/v1/devices/pairing-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hardwareUuid: state.uuid })
            }, 6000);

            if (!res.ok) throw new Error('API pairing code call failed');
            const data = await res.json();

            state.pairingCode = data.pairingCode;
            state.screenId = data.screenId;
            state.status = 'pairing';
            if (data.pocketbaseUrl) {
                POCKETBASE_URL = data.pocketbaseUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname);
                localStorage.setItem('signage_tizen_pb_url', POCKETBASE_URL);
            }
            if (data.serverUrl || data.backendUrl) {
                SERVER_URL = (data.serverUrl || data.backendUrl).replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname);
                localStorage.setItem('signage_tizen_server_url', SERVER_URL);
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
            const res = await fetchWithTimeout(url, {}, 5000);
            
            // Screen deleted or un-paired on CMS dashboard -> Unpair device!
            if (!res.ok) {
                if (res.status === 404) {
                    console.log("Screen record not found on server (HTTP 404). Unpairing device and purging local cache...");
                    disconnectDevice();
                    return;
                }
                throw new Error(`Failed to retrieve screen record: ${res.status}`);
            }

            const data = await res.json();

            // Check if status indicates deleted or unpaired
            if (data.status === 'deleted' || data.status === 'unpaired') {
                console.log("Screen status is deleted/unpaired. Disconnecting device...");
                disconnectDevice();
                return;
            }

            state.lastSyncedAt = Date.now();
            localStorage.setItem('signage_tizen_last_sync', state.lastSyncedAt);

            let hasChanged = false;

            const oldStatus = state.status;
            const oldVolume = state.volume;
            state.status = data.status || 'pairing';
            state.volume = data.volume || 80;

            if (oldStatus !== state.status || oldVolume !== state.volume) {
                hasChanged = true;
                localStorage.setItem(KEYS.STATUS, state.status);
                localStorage.setItem(KEYS.VOLUME, state.volume);
            }

            // Sync white-label branding
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

            // Command 1: Clear Cache
            if (data.clear_cache) {
                console.log("Received clear cache instruction.");
                state.cacheBust = Date.now().toString();
                localStorage.setItem('signage_tizen_cache_bust', state.cacheBust);
                localStorage.removeItem(KEYS.PLAYLIST);
                state.playlist = [];
                hasChanged = true;
                await clearScreenCommandOnServer('clear_cache');
            }

            // Command 2: Force Sync
            if (data.force_sync) {
                console.log("Received force sync instruction.");
                state.cacheBust = Date.now().toString();
                localStorage.setItem('signage_tizen_cache_bust', state.cacheBust);
                localStorage.removeItem(KEYS.PLAYLIST);
                state.playlist = [];
                state.currentAssetIndex = 0;
                hasChanged = true;
                await clearScreenCommandOnServer('force_sync');
            }

            // Command 3: Restart Playlist
            if (data.restart_playlist) {
                console.log("Received restart playlist instruction.");
                state.currentAssetIndex = 0;
                hasChanged = true;
                await clearScreenCommandOnServer('restart_playlist');
                startPlaylistRotation();
            }

            // Scheduled playlist check
            let activePlaylistId = data.playlistId || data.playlist;
            if (data.schedulePlaylist && data.scheduleDate && data.scheduleTime) {
                if (isScheduleDue(data.scheduleDate, data.scheduleTime)) {
                    console.log(`Schedule triggered! Switching active playlist to: ${data.schedulePlaylist}`);
                    const scheduledPlaylistId = await fetchScheduledPlaylistId(data.schedulePlaylist);
                    if (scheduledPlaylistId) {
                        activePlaylistId = scheduledPlaylistId;
                        hasChanged = true;
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
                        localStorage.removeItem(KEYS.PLAYLIST);
                        localStorage.removeItem('signage_tizen_playlist_id');
                        localStorage.removeItem('signage_tizen_screen_updated');
                        hasChanged = true;
                    }
                }
            }

            // Sync Widget overlays
            const oldWidget = JSON.stringify(state.widget);
            state.widget = {
                type: data.widgetType || '',
                placement: data.widgetPlacement || 'bottom-right',
                link: data.widgetLink || ''
            };
            if (oldWidget !== JSON.stringify(state.widget)) {
                hasChanged = true;
                localStorage.setItem(KEYS.WIDGET, JSON.stringify(state.widget));
            }

            if (hasChanged) {
                updateUI();
            }
        } catch (err) {
            console.error("Error fetching screen configuration:", err);
        }
    }

    // Check if scheduled date/time is due
    function isScheduleDue(dateStr, timeStr) {
        try {
            const target = new Date(`${dateStr}T${timeStr}`);
            const now = new Date();
            return now >= target;
        } catch (e) {
            return false;
        }
    }

    // Fetch playlist record ID from title
    async function fetchScheduledPlaylistId(playlistName) {
        try {
            const res = await fetch(`${POCKETBASE_URL}/api/collections/playlists/records?filter=(name='${encodeURIComponent(playlistName)}')`);
            if (res.ok) {
                const data = await res.json();
                if (data.items && data.items.length > 0) {
                    return data.items[0].id;
                }
            }
        } catch (e) {
            console.error("Error finding scheduled playlist ID:", e);
        }
        return null;
    }

    // Fetch playlist details and sync media items
    async function fetchPlaylist(playlistId) {
        try {
            const res = await fetchWithTimeout(`${POCKETBASE_URL}/api/collections/playlists/records/${playlistId}`, {}, 5000);
            if (!res.ok) {
                if (res.status === 404) {
                    console.log("Assigned playlist record was deleted (HTTP 404). Clearing playlist.");
                    state.playlist = [];
                    state.playlistId = '';
                    localStorage.removeItem(KEYS.PLAYLIST);
                    updateUI();
                    return;
                }
                throw new Error(`Playlist record fetch failed: ${res.status}`);
            }

            const data = await res.json();

            // Sync widget settings from playlist if set
            if (data.widgetType) {
                state.widget = {
                    type: data.widgetType,
                    placement: data.widgetPlacement || 'bottom-right',
                    link: data.widgetLink || ''
                };
                localStorage.setItem(KEYS.WIDGET, JSON.stringify(state.widget));
            }

            const lastUpdated = data.updated;
            const cachedPlaylistUpdated = localStorage.getItem('signage_tizen_playlist_updated') || '';
            const isPlaylistEmpty = !state.playlist || state.playlist.length === 0;

            if (lastUpdated === cachedPlaylistUpdated && !isPlaylistEmpty) {
                console.log("Playlist content timestamp is unchanged. Skipping media item fetch and file sync.");
                return;
            }

            let fetchedAssets = [];

            // Check for compiled video container first (client-side video compilation)
            const rawCompiledUrl = data.compiledVideoUrl || data.compiledVideo || data.compiled_video_url || data.compiled_video || data.videoUrl || data.video_url;
            if (data.isCompiled || data.is_compiled || rawCompiledUrl) {
                const compiledUrl = (rawCompiledUrl && (rawCompiledUrl.startsWith('http') || rawCompiledUrl.startsWith('data:')))
                    ? rawCompiledUrl
                    : `${POCKETBASE_URL}/api/files/playlists/${playlistId}/${rawCompiledUrl}`;

                console.log("🎬 Playlist HAS COMPILED VIDEO! Downloading single compiled video container in Tizen:", compiledUrl);
                
                let slidesArr = data.slides || [];
                if (typeof slidesArr === 'string') {
                    try { slidesArr = JSON.parse(slidesArr); } catch (e) { slidesArr = []; }
                }
                const totalDuration = (Array.isArray(slidesArr) && slidesArr.length > 0)
                    ? slidesArr.reduce((acc, s) => acc + (parseInt(s.duration, 10) || 10), 0)
                    : 30;

                const ext = compiledUrl.includes('.mp4') ? 'mp4' : 'webm';

                fetchedAssets.push({
                    id: `${playlistId}_compiled_video`,
                    url: compiledUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                    mediaType: 'video',
                    filename: `compiled_playlist_${playlistId}.${ext}`,
                    duration: totalDuration,
                    thumbnail: compiledUrl,
                    objectFit: 'cover',
                    scalePercent: 100
                });
            }
            
            // 1. Resolve from slides sequence (with custom durations, ordering) if not compiled video
            let slides = data.slides || [];
            if (typeof slides === 'string') {
                try {
                    slides = JSON.parse(slides);
                } catch (e) {
                    console.error("Failed to parse slides JSON string:", e);
                    slides = [];
                }
            }

            if (fetchedAssets.length === 0 && Array.isArray(slides) && slides.length > 0) {
                for (const slide of slides) {
                    const mediaRes = await fetchWithTimeout(`${POCKETBASE_URL}/api/collections/media_items/records/${slide.mediaId}`, {}, 5000);
                    if (mediaRes.ok) {
                        const media = await mediaRes.json();
                        const rawUrl = media.file
                            ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}`
                            : (media.fileUrl || media.videoUrl || media.url || media.thumbnail);

                        const isVideo = (media.type && media.type.toLowerCase() === 'video') ||
                                        (rawUrl && (rawUrl.includes('.mp4') || rawUrl.includes('.webm') || rawUrl.includes('.mov')));

                        fetchedAssets.push({
                            id: media.id,
                            url: rawUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                            mediaType: isVideo ? 'video' : 'image',
                            filename: media.title || `media_${media.id}`,
                            duration: parseInt(slide.duration || media.duration || 10, 10),
                            thumbnail: media.thumbnail || rawUrl,
                            objectFit: slide.objectFit || 'cover',
                            scalePercent: slide.scalePercent || 100
                        });
                    }
                }
            } 
            // 2. Fallback to assetsJson if not compiled video
            else if (fetchedAssets.length === 0 && data.assetsJson && data.assetsJson.length > 0) {
                data.assetsJson.forEach((pbAsset) => {
                    const isVideo = (pbAsset.mediaType && pbAsset.mediaType.toLowerCase() === 'video') ||
                                    (pbAsset.url && (pbAsset.url.includes('.mp4') || pbAsset.url.includes('.webm')));
                    fetchedAssets.push({
                        id: pbAsset.id,
                        url: pbAsset.url + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                        mediaType: isVideo ? 'video' : (pbAsset.mediaType ? pbAsset.mediaType.toLowerCase() : 'image'),
                        filename: pbAsset.filename,
                        duration: pbAsset.duration || 10,
                        thumbnail: pbAsset.thumbnail || pbAsset.url,
                        objectFit: pbAsset.objectFit || 'cover',
                        scalePercent: pbAsset.scalePercent || 100
                    });
                });
            } 
            // 3. Fallback to native files if not compiled video
            else if (fetchedAssets.length === 0 && data.files && data.files.length > 0) {
                data.files.forEach((fileName, index) => {
                    const rawUrl = `${POCKETBASE_URL}/api/files/playlists/${playlistId}/${fileName}`;
                    const isVideo = fileName.endsWith('.mp4') || fileName.endsWith('.webm');
                    fetchedAssets.push({
                        id: `${playlistId}_${index}`,
                        url: rawUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                        mediaType: isVideo ? 'video' : 'image',
                        filename: fileName,
                        duration: 10,
                        thumbnail: rawUrl,
                        objectFit: 'cover',
                        scalePercent: 100
                    });
                });
            }
            // 4. Fallback to mediaIds if not compiled video
            else if (fetchedAssets.length === 0 && data.mediaIds && data.mediaIds.length > 0) {
                for (const mediaId of data.mediaIds) {
                    const mediaRes = await fetchWithTimeout(`${POCKETBASE_URL}/api/collections/media_items/records/${mediaId}`, {}, 5000);
                    if (mediaRes.ok) {
                        const media = await mediaRes.json();
                        const rawUrl = media.file
                            ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}`
                            : (media.fileUrl || media.videoUrl || media.url || media.thumbnail);

                        const isVideo = (media.type && media.type.toLowerCase() === 'video') ||
                                        (rawUrl && (rawUrl.includes('.mp4') || rawUrl.includes('.webm') || rawUrl.includes('.mov')));

                        fetchedAssets.push({
                            id: media.id,
                            url: rawUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                            mediaType: isVideo ? 'video' : 'image',
                            filename: media.title || `media_${media.id}`,
                            duration: media.duration || 10,
                            thumbnail: media.thumbnail || rawUrl,
                            objectFit: 'cover',
                            scalePercent: 100
                        });
                    }
                }
            }

            // Apply shuffle if configured
            if (data.shuffle && fetchedAssets.length > 0) {
                fetchedAssets = fetchedAssets.sort(() => Math.random() - 0.5);
            }

            // Sync transitions and loop flags
            state.playlistTransition = data.transition || 'fade';
            state.playlistLoop = data.loop !== false;
            state.orientation = data.orientation || 'horizontal';

            localStorage.setItem('signage_tizen_transition', state.playlistTransition);
            localStorage.setItem('signage_tizen_loop', state.playlistLoop);
            localStorage.setItem('signage_tizen_orientation', state.orientation);

            applyOrientation();

            // Sync files to TV internal storage and block until finished
            try {
                const localAssets = await syncLocalFiles(fetchedAssets.map(a => Object.assign({}, a)));
                
                const newKeys = localAssets.map(a => `${a.id}_${a.duration}`);
                const currentKeys = state.playlist.map(a => `${a.id}_${a.duration}`);
                const isDifferent = JSON.stringify(newKeys) !== JSON.stringify(currentKeys);
                
                state.playlist = localAssets;
                localStorage.setItem(KEYS.PLAYLIST, JSON.stringify(state.playlist));

                // Purge unreferenced local cache files to free storage
                purgeUnusedCacheFiles(localAssets);

                if (isDifferent || isPlaylistEmpty) {
                    state.currentAssetIndex = 0;
                    updateUI();
                    startPlaylistRotation();
                } else {
                    updateUI();
                }
            } catch (syncErr) {
                console.error("Local file sync failed:", syncErr);
            }

            localStorage.setItem('signage_tizen_playlist_updated', lastUpdated);
        } catch (err) {
            console.error("Error syncing playlist assets:", err);
        }
    }

    // Write binary ArrayBuffer directly to Tizen FileStream safely & efficiently
    async function writeBufferToFile(dir, filename, arrayBuffer) {
        try {
            const existing = dir.resolve(filename);
            if (existing) {
                dir.deleteFile(existing.fullPath, () => {}, () => {});
            }
        } catch (e) {
            // File does not exist yet
        }

        const file = dir.createFile(filename);
        const bytes = new Uint8Array(arrayBuffer);

        return new Promise((resolve, reject) => {
            file.openStream("w", (stream) => {
                try {
                    if (typeof stream.writeDataNonBlocking === 'function') {
                        stream.writeDataNonBlocking(bytes, () => {
                            try { stream.close(); } catch (e) {}
                            resolve();
                        }, (writeErr) => {
                            try { stream.close(); } catch (e) {}
                            reject(writeErr);
                        });
                    } else if (typeof stream.writeData === 'function') {
                        stream.writeData(bytes);
                        try { stream.close(); } catch (e) {}
                        resolve();
                    } else {
                        // Chunked Base64 encoding fallback for older Tizen APIs
                        let binary = '';
                        const len = bytes.byteLength;
                        const chunkSize = 16384;
                        for (let i = 0; i < len; i += chunkSize) {
                            const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
                            binary += String.fromCharCode.apply(null, chunk);
                        }
                        const base64Data = window.btoa(binary);

                        if (typeof stream.writeBase64NonBlocking === 'function') {
                            stream.writeBase64NonBlocking(base64Data, () => {
                                try { stream.close(); } catch (e) {}
                                resolve();
                            }, (writeErr) => {
                                try { stream.close(); } catch (e) {}
                                reject(writeErr);
                            });
                        } else if (typeof stream.writeBase64 === 'function') {
                            stream.writeBase64(base64Data);
                            try { stream.close(); } catch (e) {}
                            resolve();
                        } else {
                            stream.write(base64Data);
                            try { stream.close(); } catch (e) {}
                            resolve();
                        }
                    }
                } catch (writeErr) {
                    try { stream.close(); } catch (e) {}
                    reject(writeErr);
                }
            }, (streamErr) => {
                reject(streamErr);
            });
        });
    }

    // Offline caching: sync remote files to local Tizen filesystem storage
    async function syncLocalFiles(assets) {
        if (!window.tizen || !window.tizen.filesystem) {
            console.log("Not running on Tizen screen. Skipping offline local filesystem sync.");
            return assets;
        }

        const progressContainer = document.getElementById('download-progress-container');
        const progressBar = document.getElementById('download-progress-bar');
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (progressBar) progressBar.style.width = '0%';

        function updateProgress(completed, total) {
            if (views.splashStatus) {
                views.splashStatus.innerText = `Downloading offline assets... ${completed}/${total}`;
            }
            if (progressBar) {
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                progressBar.style.width = `${pct}%`;
            }
        }

        try {
            const dir = await new Promise((resolve, reject) => {
                window.tizen.filesystem.resolve("wgt-private", resolve, reject, "rw");
            });

            console.log("Local wgt-private storage resolved. Syncing assets...");
            updateProgress(0, assets.length);

            for (let i = 0; i < assets.length; i++) {
                const asset = assets[i];
                if (!asset.url) continue;

                const cleanUrl = asset.url.split('?')[0];
                let ext = 'png';
                if (asset.mediaType === 'video' || cleanUrl.endsWith('.mp4')) ext = 'mp4';
                else if (cleanUrl.endsWith('.gif')) ext = 'gif';
                else if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) ext = 'jpg';
                else if (cleanUrl.endsWith('.webp')) ext = 'webp';

                const filename = `asset_${asset.id}.${ext}`;

                try {
                    const file = dir.resolve(filename);
                    if (file && file.fileSize && file.fileSize > 0) {
                        const localUri = getFileURI(file);
                        console.log(`Asset ${filename} already exists locally (${file.fileSize} bytes): ${localUri}`);
                        asset.url = localUri;
                    } else {
                        throw new Error("Local file missing or 0 bytes");
                    }
                } catch (e) {
                    console.log(`Downloading asset: ${asset.url} as ${filename}`);
                    
                    try {
                        let response;
                        try {
                            response = await fetchWithTimeout(asset.url, {}, 5000);
                            if (!response.ok) throw new Error("Direct fetch failed");
                        } catch (directErr) {
                            console.log(`Direct download failed (CORS/network). Trying proxy for: ${asset.url}`);
                            const proxyUrl = `${SERVER_URL}/api/v1/public/proxy-media?url=${encodeURIComponent(asset.url)}`;
                            response = await fetchWithTimeout(proxyUrl, {}, 15000);
                            if (!response.ok) throw new Error("Proxy download failed");
                        }
                        
                        const arrayBuffer = await response.arrayBuffer();
                        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                            throw new Error("Downloaded media buffer is empty (0 bytes)");
                        }

                        await writeBufferToFile(dir, filename, arrayBuffer);

                        const file = dir.resolve(filename);
                        console.log(`Successfully cached asset ${filename} locally (${arrayBuffer.byteLength} bytes).`);
                        asset.url = getFileURI(file);
                    } catch (dlErr) {
                        console.error(`Failed to download and write asset ${filename}:`, dlErr);
                    }
                }
                updateProgress(i + 1, assets.length);
                await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
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
                    const file = dir.resolve(qrFilename);
                    if (file && file.fileSize && file.fileSize > 0) {
                        state.qrcodeLocalPath = getFileURI(file);
                        localStorage.setItem('signage_qrcode_local_path', state.qrcodeLocalPath);
                    } else {
                        throw new Error("QR file missing or 0 bytes");
                    }
                } catch (e) {
                    console.log(`Downloading updated QR code image: ${qrFilename}`);
                    try {
                        const response = await fetchWithTimeout(qrUrl, {}, 5000);
                        if (!response.ok) throw new Error("QR network fetch failed");
                        const arrayBuffer = await response.arrayBuffer();
                        await writeBufferToFile(dir, qrFilename, arrayBuffer);

                        const file = dir.resolve(qrFilename);
                        state.qrcodeLocalPath = getFileURI(file);
                        localStorage.setItem('signage_qrcode_local_path', state.qrcodeLocalPath);
                    } catch (qrErr) {
                        console.error("QR Code offline download failed:", qrErr);
                    }
                }
            }

            if (!state.imageElementsCache) {
                state.imageElementsCache = {};
            }

            // Pre-decode images into DOM/memory
            const imageAssets = assets.filter(a => a.mediaType === 'image' && a.url);
            if (imageAssets.length > 0) {
                for (let k = 0; k < imageAssets.length; k++) {
                    const asset = imageAssets[k];
                    if (state.imageElementsCache[asset.id] && state.imageElementsCache[asset.id].src === asset.url) {
                        continue;
                    }

                    try {
                        await new Promise((resolve) => {
                            const img = new Image();
                            img.className = 'media-element';
                            img.style.display = 'block';
                            img.style.opacity = '0.001';
                            img.style.zIndex = '1';

                            img.onload = () => {
                                const container = document.getElementById('media-container');
                                if (container && img.parentNode !== container) {
                                    container.appendChild(img);
                                }
                                if (typeof img.decode === 'function') {
                                    img.decode().then(() => {
                                        state.imageElementsCache[asset.id] = img;
                                        resolve();
                                    }).catch(() => {
                                        state.imageElementsCache[asset.id] = img;
                                        resolve();
                                    });
                                } else {
                                    state.imageElementsCache[asset.id] = img;
                                    resolve();
                                }
                            };
                            img.onerror = () => resolve();
                            img.src = asset.url;
                        });
                    } catch (decodeErr) {
                        console.warn(`Pre-decoding failed for ${asset.filename}:`, decodeErr);
                    }
                }
            }

            return assets;
        } catch (err) {
            console.error("Local filesystem sync failed:", err);
            return assets;
        } finally {
            if (progressContainer) progressContainer.classList.add('hidden');
        }
    }

    // Purge unreferenced local cache files from Tizen filesystem storage
    async function purgeUnusedCacheFiles(activeAssets) {
        if (!window.tizen || !window.tizen.filesystem) return;
        try {
            const dir = await new Promise((resolve, reject) => {
                window.tizen.filesystem.resolve("wgt-private", resolve, reject, "rw");
            });

            const activeLocalPaths = activeAssets.map(a => a.url).filter(url => url && url.startsWith('file:'));
            if (state.qrcodeLocalPath) activeLocalPaths.push(state.qrcodeLocalPath);

            dir.listFiles((files) => {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (!file.isFile) continue;
                    const uri = getFileURI(file);
                    if (file.name.startsWith('asset_') || file.name.startsWith('qrcode_')) {
                        if (!activeLocalPaths.includes(uri) && !activeLocalPaths.includes(file.fullPath)) {
                            console.log(`Purging unreferenced local Tizen file: ${file.name}`);
                            try { dir.deleteFile(file.fullPath); } catch (e) {}
                        }
                    }
                }
            }, (err) => console.error("Error listing files for cache purge:", err));
        } catch (e) {
            console.error("Cache purge failed:", e);
        }
    }

    // Start playlist rotation loop
    function startPlaylistRotation() {
        if (rotationTimeout) {
            clearTimeout(rotationTimeout);
            rotationTimeout = null;
        }
        rotationToken++;

        if (!state.playlist || state.playlist.length === 0) {
            console.log("No items in playlist. Returning to standby.");
            updateUI();
            return;
        }

        renderAsset();
    }

    // Advance to next playlist asset
    function advancePlaylist() {
        if (!state.playlist || state.playlist.length === 0) return;

        state.currentAssetIndex++;
        if (state.currentAssetIndex >= state.playlist.length) {
            if (state.playlistLoop) {
                state.currentAssetIndex = 0;
            } else {
                state.currentAssetIndex = state.playlist.length - 1;
                return;
            }
        }
        renderAsset();
    }

    // Render current asset (image or video)
    function renderAsset() {
        if (rotationTimeout) {
            clearTimeout(rotationTimeout);
            rotationTimeout = null;
        }
        const currentToken = ++rotationToken;

        if (!state.playlist || state.playlist.length === 0) return;

        if (state.currentAssetIndex >= state.playlist.length) {
            state.currentAssetIndex = 0;
        }

        const asset = state.playlist[state.currentAssetIndex];
        if (!asset) return;

        console.log(`Rendering asset [${state.currentAssetIndex + 1}/${state.playlist.length}]: ${asset.filename || asset.id} (${asset.mediaType})`);

        if (state.isOutOfRange) {
            views.imagePlayer1.style.display = 'none';
            views.imagePlayer2.style.display = 'none';
            views.videoPlayer.style.display = 'none';
            views.videoPlayer.pause();
            if (views.outOfRange) {
                views.outOfRange.style.display = 'flex';
            }
            const duration = (asset.duration || 10) * 1000;
            rotationTimeout = setTimeout(() => {
                if (currentToken === rotationToken) {
                    advancePlaylist();
                }
            }, duration);
            return;
        }

        if (views.outOfRange) {
            views.outOfRange.style.display = 'none';
        }

        const transitionName = state.playlistTransition || 'fade';
        const animClass = 'animate-' + (
            transitionName === 'slide' ? 'slideIn' :
            transitionName === 'zoom' ? 'zoomIn' :
            transitionName === 'slide-up' ? 'slideUp' :
            transitionName === 'slide-down' ? 'slideDown' :
            transitionName === 'blur' ? 'blurIn' :
            transitionName === 'bounce' ? 'bounceIn' : 'fadeIn'
        );

        const activePlayer = activeImagePlayerNum === 1 ? views.imagePlayer1 : views.imagePlayer2;
        const inactivePlayer = activeImagePlayerNum === 1 ? views.imagePlayer2 : views.imagePlayer1;

        if (asset.mediaType === 'video') {
            views.videoPlayer.style.objectFit = asset.objectFit || 'cover';
            activePlayer.style.objectFit = asset.objectFit || 'cover';

            const scale = asset.scalePercent ? `scale(${asset.scalePercent / 100})` : 'scale(1)';
            views.videoPlayer.style.transform = scale;
            activePlayer.style.transform = scale;

            if (asset.thumbnail) {
                activePlayer.className = 'media-element';
                activePlayer.src = asset.thumbnail;
                activePlayer.style.display = 'block';
                activePlayer.style.opacity = '1';
            }

            views.videoPlayer.style.opacity = '0';
            views.videoPlayer.style.display = 'block';
            views.videoPlayer.src = asset.url;
            views.videoPlayer.volume = state.volume / 100;

            const handleVideoPlaying = () => {
                if (currentToken !== rotationToken) return;
                views.videoPlayer.className = 'media-element';
                views.videoPlayer.style.opacity = '1';
                
                activePlayer.style.opacity = '0';
                inactivePlayer.style.opacity = '0';
                setTimeout(() => {
                    if (currentToken === rotationToken) {
                        activePlayer.style.display = 'none';
                        inactivePlayer.style.display = 'none';
                    }
                }, 600);

                if (transitionName !== 'none') {
                    setTimeout(() => {
                        if (currentToken === rotationToken) {
                            views.videoPlayer.classList.add(animClass);
                        }
                    }, 20);
                }
                views.videoPlayer.removeEventListener('playing', handleVideoPlaying);
            };
            views.videoPlayer.addEventListener('playing', handleVideoPlaying);

            views.videoPlayer.play().then(() => {
                const duration = Math.max(parseInt(asset.duration, 10) || 10, 3) * 1000;
                rotationTimeout = setTimeout(() => {
                    if (currentToken === rotationToken) {
                        views.videoPlayer.pause();
                        advancePlaylist();
                    }
                }, duration);
            }).catch(e => {
                console.warn("Autoplay block / playback error on video", e);
                views.videoPlayer.removeEventListener('playing', handleVideoPlaying);
                sendHeartbeat(`Video autoplay error: ${asset.filename || asset.id}`);
                rotationTimeout = setTimeout(() => {
                    if (currentToken === rotationToken) {
                        advancePlaylist();
                    }
                }, 5000);
            });
        } else {
            // Image playback logic using pre-decoded or double-buffered player
            views.videoPlayer.style.opacity = '0.001';
            setTimeout(() => {
                if (currentToken === rotationToken) {
                    views.videoPlayer.style.display = 'none';
                }
            }, 600);
            
            if (!state.imageElementsCache[asset.id]) {
                const img = new Image();
                img.className = 'media-element';
                img.style.display = 'block';
                img.style.opacity = '0.001';
                img.style.zIndex = '1';
                img.src = asset.url;
                state.imageElementsCache[asset.id] = img;
            }

            const imgElement = state.imageElementsCache[asset.id];
            imgElement.style.objectFit = asset.objectFit || 'cover';
            const scale = asset.scalePercent ? `scale(${asset.scalePercent / 100})` : 'scale(1)';
            imgElement.style.transform = scale;

            // Transition animations
            const container = document.getElementById('media-container');
            if (container && imgElement.parentNode !== container) {
                container.appendChild(imgElement);
            }

            imgElement.className = 'media-element';
            imgElement.style.display = 'block';
            imgElement.style.opacity = '1';
            imgElement.style.zIndex = '10';

            if (transitionName !== 'none') {
                imgElement.classList.add(animClass);
            }

            activePlayer.style.opacity = '0';
            inactivePlayer.style.opacity = '0';
            setTimeout(() => {
                if (currentToken === rotationToken) {
                    activePlayer.style.display = 'none';
                    inactivePlayer.style.display = 'none';
                }
            }, 600);

            activeImagePlayerNum = activeImagePlayerNum === 1 ? 2 : 1;

            const duration = Math.max(parseInt(asset.duration, 10) || 10, 2) * 1000;
            rotationTimeout = setTimeout(() => {
                if (currentToken === rotationToken) {
                    advancePlaylist();
                }
            }, duration);
        }
    }

    // Sync overlay widgets (QR code, weather, clock, RSS)
    function syncWidgets() {
        const w = state.widget;
        if (!w || !w.type) {
            widgets.overlay.style.display = 'none';
            return;
        }

        widgets.overlay.style.display = 'block';
        const activeTypes = w.type.split(',').map(s => s.trim().toLowerCase());

        // Placement class
        widgets.overlay.className = 'widgets-overlay-container ' + (w.placement || 'bottom-right');

        // QR Code
        if (activeTypes.includes('qrcode') && w.link) {
            widgets.qrcode.classList.remove('hidden');
            let qrcodeLink = w.link;
            if (w.link.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(w.link);
                    if (parsed.qrcode) qrcodeLink = parsed.qrcode;
                } catch (e) {}
            }
            const qrSrc = state.qrcodeLocalPath || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrcodeLink)}`;
            widgets.qrcodeImg.src = qrSrc;
        } else {
            widgets.qrcode.classList.add('hidden');
        }

        // Weather HUD
        if (activeTypes.includes('weather')) {
            widgets.weather.classList.remove('hidden');
        } else {
            widgets.weather.classList.add('hidden');
        }

        // Clock HUD
        if (activeTypes.includes('clock')) {
            widgets.clock.classList.remove('hidden');
        } else {
            widgets.clock.classList.add('hidden');
        }

        // RSS Ticker
        if (activeTypes.includes('rss')) {
            widgets.rss.classList.remove('hidden');
            let rssMsg = "Welcome to SignageOS Digital Signage Network";
            if (w.link) {
                if (w.link.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(w.link);
                        if (parsed.rss) rssMsg = parsed.rss;
                    } catch (e) {}
                } else if (!w.link.startsWith('http')) {
                    rssMsg = w.link;
                }
            }
            widgets.rssText.innerText = rssMsg;
            widgets.rssTextDup.innerText = rssMsg;
        } else {
            widgets.rss.classList.add('hidden');
        }
    }

    // Start Live Clock Overlay Interval
    function startClockWidget() {
        if (clockInterval) clearInterval(clockInterval);
        const updateClock = () => {
            if (widgets.clockTime) {
                const now = new Date();
                const hrs = String(now.getHours()).padStart(2, '0');
                const mins = String(now.getMinutes()).padStart(2, '0');
                const secs = String(now.getSeconds()).padStart(2, '0');
                widgets.clockTime.innerText = `${hrs}:${mins}:${secs}`;
            }
        };
        updateClock();
        clockInterval = setInterval(updateClock, 1000);
    }

    // Start periodic background loops
    function startSyncLoops() {
        if (syncInterval) clearInterval(syncInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);

        // Config Sync every 60 seconds
        syncInterval = setInterval(() => {
            if (state.screenId) {
                fetchScreenConfig();
            } else if (state.status === 'pairing') {
                checkPairingStatusOnServer();
            }
        }, 60000);

        // Send initial diagnostic heartbeat immediately
        sendHeartbeat();

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
            const res = await fetchWithTimeout(url, {}, 5000);
            
            // Screen record deleted on CMS during pairing check -> unpair device
            if (!res.ok) {
                if (res.status === 404) {
                    console.log("Screen record 404 during pairing check. Resetting device...");
                    disconnectDevice();
                    return;
                }
                return;
            }

            const data = await res.json();
            if (data.status && data.status !== 'pairing') {
                console.log("Device has been successfully paired!");
                state.status = data.status;
                localStorage.setItem(KEYS.STATUS, state.status);
                sendHeartbeat();
                updateUI();
            }
        } catch (err) {
            console.error("Error checking pairing status:", err);
        }
    }

    // Broadcast diagnostic heartbeat to backend API
    async function sendHeartbeat(errorMessage) {
        if (!state.uuid) return;
        if (window.navigator && window.navigator.onLine === false) return;

        try {
            const currentAsset = state.playlist[state.currentAssetIndex];
            const assetInfo = errorMessage ? `Status/Error: ${errorMessage}` : (currentAsset ? (currentAsset.filename || currentAsset.id || 'None') : 'None');
            const payload = {
                hardwareUuid: state.uuid,
                cpuTemp: 45.0,
                currentPlayingAsset: assetInfo,
                storageUsedBytes: 15 * 1024 * 1024,
                storageAvailableBytes: 85 * 1024 * 1024
            };

            const res = await fetchWithTimeout(`${SERVER_URL}/api/v1/devices/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }, 5000);

            // Screen un-paired or removed on backend -> trigger disconnect
            if (res.status === 404) {
                console.log("Heartbeat returned HTTP 404 (screen removed). Disconnecting device...");
                disconnectDevice();
            }
        } catch (err) {
            console.error("Heartbeat broadcast failed:", err);
        }
    }

    // Disconnect device, clear all local state & storage, and return to pairing screen
    function disconnectDevice() {
        console.log("Disconnecting device, clearing storage, and resetting pairing states.");

        if (rotationTimeout) {
            clearTimeout(rotationTimeout);
            rotationTimeout = null;
        }

        if (views.videoPlayer) {
            try { views.videoPlayer.pause(); } catch (e) {}
        }

        const persistentUuid = state.uuid;

        // Clear local storage state
        localStorage.clear();
        localStorage.setItem(KEYS.UUID, persistentUuid);

        // Reset state object
        state.screenId = '';
        state.pairingCode = '';
        state.status = 'pairing';
        state.playlist = [];
        state.widget = {};
        state.playlistId = '';
        state.screenUpdated = '';
        state.imageElementsCache = {};

        // Purge local cached media files
        purgeUnusedCacheFiles([]);

        updateUI();
        requestPairingCode();
    }

    // Clear Express backend commands
    async function clearScreenCommandOnServer(command) {
        try {
            await fetchWithTimeout(`${SERVER_URL}/api/v1/devices/clear-command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    screenId: state.screenId,
                    command: command
                })
            }, 3000);
        } catch (e) {
            console.error(`Failed to clear command ${command} on server:`, e);
        }
    }

    // Report error logs directly to PocketBase screen_logs collection
    async function reportError(event, detail) {
        if (!state.screenId) return;
        try {
            await fetchWithTimeout(`${POCKETBASE_URL}/api/collections/screen_logs/records`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    screenId: state.screenId,
                    screenName: 'Tizen Player',
                    event: event,
                    detail: detail,
                    type: 'error'
                })
            }, 3000);
        } catch (err) {
            console.error("Failed to post error logs:", err);
        }
    }

    // Boot application
    window.onload = init;
})();
