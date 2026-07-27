/**
 * SignageOS Player - Tizen Web Client Engine (v1.0.55 - Modular Architecture)
 */

(function () {
    const { SERVER_URL, KEYS, getPocketBaseUrl, setPocketBaseUrl } = window.SignageConfig;
    const { getOrGenerateUUID, checkScreenSize } = window.SignageStorage;
    const { applyBranding } = window.SignageBranding;
    const { renderWidgets, startClockWidget } = window.SignageWidgets;
    const { fetchWithTimeout, clearScreenCommandOnServer, requestPairingCode, checkPairingStatusOnServer, sendHeartbeat } = window.SignageApi;
    const { startPlaylistRotation, fetchPlaylist } = window.SignagePlayer;
    const { bindRemoteKeys } = window.SignageKeys;

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
        screenUpdated: localStorage.getItem('signage_tizen_screen_updated') || '',
        imageElementsCache: {}
    };

    let idleTimeout = null;

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

    let syncInterval = null;
    let heartbeatInterval = null;

    function init() {
        console.log("Initializing SignageOS Tizen App (Modular)...");
        window.widgetsRef = widgets;
        window.SignageWidgetsRef = window.SignageWidgets;
        applyBranding(state, views);
        bindRemoteKeys(views, (force) => requestPairingCode(state, views, updateUI, force));

        cancelAutoLaunchAlarm();

        window.addEventListener('keydown', resetIdleTimer);
        window.addEventListener('click', resetIdleTimer);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        if (state.screenId && state.status !== 'pairing') {
            if (state.playlist && state.playlist.length > 0) {
                views.splash.classList.remove('active');
            }
            fetchScreenConfig().then(() => {
                views.splash.classList.remove('active');
                updateUI();
            });
        } else if (state.pairingCode && state.screenId) {
            views.splash.classList.remove('active');
            updateUI();
        } else {
            requestPairingCode(state, views, updateUI).then(() => {
                views.splash.classList.remove('active');
            });
        }

        startSyncLoops();
        startClockWidget(widgets);

        checkScreenSize().then((result) => {
            state.isOutOfRange = !result.allowed;
            if (state.isOutOfRange) {
                console.warn(`Screen size verification limit reached (${result.size}"). Media content will be blocked.`);
                updateUI();
            }
        });
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            console.log("App moved to background / hidden. Scheduling auto-launch alarm in 15 seconds...");
            scheduleAutoLaunchAlarm();
        } else {
            console.log("App returned to foreground. Cancelling auto-launch alarm and resuming playback...");
            cancelAutoLaunchAlarm();

            if (state.status === 'active') {
                try {
                    const currentAsset = state.playlist[state.currentAssetIndex];
                    if (currentAsset && currentAsset.mediaType === 'video') {
                        views.videoPlayer.play().catch(e => console.warn("Failed to resume video on wake:", e));
                    }
                    startPlaylistRotation(state, views, updateUI);
                } catch (err) {
                    console.error("Failed to restore playback state on wake:", err);
                }
            }
        }
    }

    function scheduleAutoLaunchAlarm() {
        try {
            if (window.tizen && window.tizen.alarm && window.tizen.application) {
                const appId = window.tizen.application.getCurrentApplication().appInfo.id;
                cancelAutoLaunchAlarm();
                const alarm = new window.tizen.AlarmRelative(15);
                window.tizen.alarm.add(alarm, appId);
                console.log(`Successfully scheduled Tizen auto-launch alarm for appId: ${appId}`);
            }
        } catch (e) {
            console.error("Failed to schedule auto-launch alarm:", e);
        }
    }

    function cancelAutoLaunchAlarm() {
        try {
            if (window.tizen && window.tizen.alarm && window.tizen.application) {
                const appId = window.tizen.application.getCurrentApplication().appInfo.id;
                const alarms = window.tizen.alarm.getAll();
                alarms.forEach(alarm => {
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

    function applyOrientation() {
        const orientation = state.orientation || 'horizontal';
        if (orientation === 'vertical' && window.innerWidth > window.innerHeight) {
            views.playback.classList.add('rotate-portrait');
        } else {
            views.playback.classList.remove('rotate-portrait');
        }
    }

    function updateUI() {
        Object.values(views).forEach(v => {
            if (v && v.classList && v.classList.contains('screen')) {
                v.classList.remove('active');
            }
        });

        if (widgets.qrcode) widgets.qrcode.classList.add('hidden');
        if (widgets.weather) widgets.weather.classList.add('hidden');
        if (widgets.clock) widgets.clock.classList.add('hidden');
        if (widgets.rss) widgets.rss.classList.add('hidden');

        console.log(`Updating UI state: ${state.status}`);

        switch (state.status) {
            case 'pairing':
                if (views.pairingCodeText) views.pairingCodeText.innerText = state.pairingCode || '------';
                if (views.pairing) views.pairing.classList.add('active');
                resetIdleTimer();
                break;
            case 'suspended':
                if (views.suspended) views.suspended.classList.add('active');
                break;
            case 'active':
            case 'online':
            case 'offline':
                if (idleTimeout) {
                    clearTimeout(idleTimeout);
                    idleTimeout = null;
                }
                if (!state.playlist || state.playlist.length === 0) {
                    if (views.standby) views.standby.classList.add('active');
                } else {
                    applyOrientation();
                    if (views.playback) views.playback.classList.add('active');
                    startPlaylistRotation(state, views, updateUI);
                    renderWidgets(state, widgets, SERVER_URL);
                }
                break;
            default:
                if (views.pairing) views.pairing.classList.add('active');
                resetIdleTimer();
                break;
        }
    }

    function resetIdleTimer() {
        if (idleTimeout) clearTimeout(idleTimeout);

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

    async function fetchScreenConfig() {
        if (!state.screenId) return;
        if (window.navigator && window.navigator.onLine === false) {
            console.log("Device is offline. Skipping sync check.");
            return;
        }

        try {
            const POCKETBASE_URL = getPocketBaseUrl();
            const url = `${POCKETBASE_URL}/api/collections/screens/records/${state.screenId}`;
            const res = await fetchWithTimeout(url, {}, 2500);
            if (!res.ok) {
                if (res.status === 404 || res.status === 403) {
                    console.log("Screen record deleted/removed on server. Disconnecting and resetting pairing.");
                    disconnectDevice();
                    return;
                }
                throw new Error('Failed to retrieve screen record');
            }

            const data = await res.json();

            if (data.status === 'pairing') {
                console.log("Screen status reset to pairing on server. Disconnecting.");
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

            const oldBranding = JSON.stringify(state.branding);
            state.branding = {
                isWhiteLabel: !!data.whiteLabel,
                logoUrl: data.websiteLogo || '',
                name: data.websiteName || ''
            };
            if (oldBranding !== JSON.stringify(state.branding)) {
                hasChanged = true;
                localStorage.setItem(KEYS.BRANDING, JSON.stringify(state.branding));
                applyBranding(state, views);
            }

            const screenWidget = {
                type: data.widgetType !== undefined ? data.widgetType : (state.widget ? state.widget.type : null),
                placement: data.widgetPlacement || (state.widget ? state.widget.placement : 'top-right'),
                link: data.widgetLink !== undefined ? data.widgetLink : (state.widget ? state.widget.link : '')
            };
            if (JSON.stringify(state.widget) !== JSON.stringify(screenWidget)) {
                state.widget = screenWidget;
                hasChanged = true;
                localStorage.setItem(KEYS.WIDGET, JSON.stringify(state.widget));
            }

            if (data.clear_cache) {
                console.log("Received clear cache instruction.");
                state.cacheBust = Date.now().toString();
                localStorage.setItem('signage_tizen_cache_bust', state.cacheBust);
                localStorage.removeItem(KEYS.PLAYLIST);
                state.playlist = [];
                hasChanged = true;
                await clearScreenCommandOnServer(state.screenId, 'clear_cache');
            }

            if (data.force_sync) {
                console.log("Received force sync instruction.");
                state.cacheBust = Date.now().toString();
                localStorage.setItem('signage_tizen_cache_bust', state.cacheBust);
                localStorage.removeItem(KEYS.PLAYLIST);
                state.playlist = [];
                state.currentAssetIndex = 0;
                hasChanged = true;
                await clearScreenCommandOnServer(state.screenId, 'force_sync');
            }

            if (data.restart_playlist) {
                console.log("Received restart playlist instruction.");
                state.currentAssetIndex = 0;
                hasChanged = true;
                await clearScreenCommandOnServer(state.screenId, 'restart_playlist');
                startPlaylistRotation(state, views, updateUI);
            }

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

            if (state.status === "active" || state.status === "online") {
                if (activePlaylistId) {
                    state.playlistId = activePlaylistId;
                    await fetchPlaylist(activePlaylistId, state, views, updateUI);
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

    async function fetchScheduledPlaylistId(playlistName) {
        try {
            if (playlistName === "Normal" || playlistName === "Unassigned") return "";
            const POCKETBASE_URL = getPocketBaseUrl();
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

    function startSyncLoops() {
        if (syncInterval) clearInterval(syncInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);

        syncInterval = setInterval(() => {
            if (state.status === 'pairing') {
                checkPairingStatusOnServer(state, updateUI);
            } else if (state.screenId) {
                fetchScreenConfig();
            }
        }, 2000);

        heartbeatInterval = setInterval(() => {
            sendHeartbeat(state);
        }, 30000);
    }

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
        requestPairingCode(state, views, updateUI);
    }

    window.onload = init;
})();
