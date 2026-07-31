/**
 * SignageOS Player - Tizen Web Client Engine
 */

(function () {
    const { KEYS, getPocketBaseUrl } = window.SignageConfig;
    const { getOrGenerateUUID } = window.SignageStorage;
    const { requestPairingCode, checkPairingStatusOnServer, clearScreenCommandOnServer, clearGroupCommandOnServer, fetchWithTimeout, reportOfflineOnServer, sendHeartbeatOnServer, logDeviceEvent } = window.SignageApi;
    const { startPlaylistRotation, fetchPlaylist, stopAndUnloadVideo, stopPlaylistRotation } = window.SignagePlayer;
    const { bindRemoteKeys } = window.SignageKeys;

    let state = {
        uuid: getOrGenerateUUID(),
        screenId: localStorage.getItem(KEYS.SCREEN_ID) || '',
        pairingCode: localStorage.getItem(KEYS.PAIRING_CODE) || '',
        status: localStorage.getItem(KEYS.STATUS) || 'pairing',
        playlist: JSON.parse(localStorage.getItem(KEYS.PLAYLIST) || '[]'),
        currentAssetIndex: 0,
        orientation: localStorage.getItem('signage_tizen_orientation') || 'horizontal',
        playlistId: localStorage.getItem('signage_tizen_playlist_id') || '',
        isRotating: false,
        screenName: localStorage.getItem('signage_tizen_screen_name') || '',
        assignedToUserEmail: localStorage.getItem('signage_tizen_user_email') || ''
    };

    const views = {
        pairing: document.getElementById('pairing-screen'),
        standby: document.getElementById('standby-screen'),
        playback: document.getElementById('playback-screen'),
        pairingCodeText: document.getElementById('pairing-code'),
        pairingStatusMsg: document.getElementById('pairing-status-message'),
        refreshCodeBtn: document.getElementById('refresh-code-btn'),
        imagePlayer1: document.getElementById('image-player-1'),
        imagePlayer2: document.getElementById('image-player-2'),
        videoPlayer: document.getElementById('video-player')
    };

    let syncInterval = null;
    let heartbeatInterval = null;

    function isScheduleDue(scheduleDate, scheduleTime) {
        if (!scheduleDate || !scheduleTime) return false;
        try {
            const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
            if (isNaN(scheduledDateTime.getTime())) return false;
            return Date.now() >= scheduledDateTime.getTime();
        } catch (_) {
            return false;
        }
    }

    function init() {
        console.log("Initializing SignageOS Tizen App Engine...");
        window.viewsRef = views;
        bindRemoteKeys(views, (force) => requestPairingCode(state, views, updateUI, force));

        window.addEventListener('online', () => {
            console.log("[Tizen] Display network reconnected.");
            if (state.screenId) {
                logDeviceEvent(state, 'Screen came online', 'online', 'Network connectivity restored.');
                sendHeartbeatOnServer(state);
            }
        });

        window.addEventListener('offline', () => {
            console.warn("[Tizen] Display network disconnected.");
            if (state.screenId) {
                logDeviceEvent(state, 'Screen went offline', 'offline', 'Network connectivity lost.');
            }
        });

        if (state.screenId && state.status !== 'pairing') {
            // Offline-first: paint cached playlist immediately so playback starts instantly
            updateUI();
            fetchScreenConfig();
            sendHeartbeatOnServer(state);
            logDeviceEvent(state, 'Screen came online', 'online', 'Tizen TV player engine initialized and active');
        } else {
            requestPairingCode(state, views, updateUI);
        }

        startSyncLoop();
        startHeartbeatLoop();
    }

    function applyOrientation() {
        const orientation = (state.orientation || 'horizontal').toLowerCase();
        if ((orientation === 'vertical' || orientation === 'portrait') && window.innerWidth > window.innerHeight) {
            views.playback.classList.add('rotate-portrait');
        } else {
            views.playback.classList.remove('rotate-portrait');
        }
    }

    function updateUI() {
        if (views.pairing) views.pairing.classList.remove('active');
        if (views.standby) views.standby.classList.remove('active');
        if (views.playback) views.playback.classList.remove('active');

        console.log(`UI State: ${state.status}`);

        switch (state.status) {
            case 'pairing':
                if (window.SignageWidgets) window.SignageWidgets.hideAllWidgets();
                if (stopPlaylistRotation) stopPlaylistRotation(state, views);
                if (views.pairingCodeText) views.pairingCodeText.innerText = state.pairingCode || '------';
                if (views.pairing) views.pairing.classList.add('active');
                break;
            case 'active':
            case 'online':
            case 'offline':
                if (!state.playlist || state.playlist.length === 0) {
                    if (window.SignageWidgets) window.SignageWidgets.hideAllWidgets();
                    if (stopPlaylistRotation) stopPlaylistRotation(state, views);
                    if (views.standby) views.standby.classList.add('active');
                } else {
                    applyOrientation();
                    if (views.playback) views.playback.classList.add('active');
                    if (!state.isRotating) {
                        state.isRotating = true;
                        startPlaylistRotation(state, views, updateUI);
                    }
                }
                break;
            default:
                if (window.SignageWidgets) window.SignageWidgets.hideAllWidgets();
                if (stopPlaylistRotation) stopPlaylistRotation(state, views);
                if (views.pairing) views.pairing.classList.add('active');
                break;
        }
    }

    async function fetchScreenConfig() {
        if (!state.screenId) return;
        if (window.navigator && window.navigator.onLine === false) return;

        try {
            const POCKETBASE_URL = getPocketBaseUrl();
            const url = `${POCKETBASE_URL}/api/collections/screens/records/${state.screenId}`;
            const res = await fetchWithTimeout(url, {}, 2500);
            if (!res.ok) {
                if (res.status === 404 || res.status === 403) {
                    disconnectDevice();
                    return;
                }
                return;
            }

            const data = await res.json();

            if (data.status === 'pairing') {
                disconnectDevice();
                return;
            }

            let hasChanged = false;

            if (state.status !== data.status) {
                state.status = data.status || 'pairing';
                localStorage.setItem(KEYS.STATUS, state.status);
                hasChanged = true;
            }

            let groupData = null;
            const validGroupId = typeof data.groupId === 'string' && /^[a-zA-Z0-9]{15}$/.test(data.groupId.trim()) ? data.groupId.trim() : null;
            if (validGroupId) {
                try {
                    const groupUrl = `${POCKETBASE_URL}/api/collections/screen_groups/records/${validGroupId}`;
                    const groupRes = await fetchWithTimeout(groupUrl, {}, 2000);
                    if (groupRes.ok) {
                        groupData = await groupRes.json();
                    }
                } catch (_) {}
            }

            let activePlaylistId = data.playlistId || data.playlist;
            if ((!activePlaylistId || activePlaylistId === 'None') && groupData) {
                activePlaylistId = groupData.playlistId || groupData.playlist;
            }

            const schedPlaylist = data.schedulePlaylist || (groupData ? groupData.schedulePlaylist : null);
            const schedDate = data.scheduleDate || (groupData ? groupData.scheduleDate : null);
            const schedTime = data.scheduleTime || (groupData ? groupData.scheduleTime : null);

            if (schedPlaylist && schedDate && schedTime) {
                if (isScheduleDue(schedDate, schedTime)) {
                    activePlaylistId = schedPlaylist;
                }
            }

            const isNone = !activePlaylistId || activePlaylistId === 'None';

            // 1. If playlist is set to "None" or unassigned, stop playback immediately and return to standby
            if (isNone) {
                stopPlaylistRotation(state, views);
                state.playlist = [];
                state.playlistId = '';
                state.currentAssetIndex = 0;
                localStorage.setItem(KEYS.PLAYLIST, '[]');
                localStorage.removeItem('signage_tizen_playlist_id');

                if (window.SignagePlayer && window.SignagePlayer.syncLocalFiles) {
                    await window.SignagePlayer.syncLocalFiles([]);
                }

                if (data.clear_cache) await clearScreenCommandOnServer(state.screenId, 'clear_cache');
                if (data.force_sync) await clearScreenCommandOnServer(state.screenId, 'force_sync');
                if (data.restart_playlist) await clearScreenCommandOnServer(state.screenId, 'restart_playlist');
                if (validGroupId && groupData) {
                    if (groupData.clear_cache) await clearGroupCommandOnServer(validGroupId, 'clear_cache');
                    if (groupData.force_sync) await clearGroupCommandOnServer(validGroupId, 'force_sync');
                    if (groupData.restart_playlist) await clearGroupCommandOnServer(validGroupId, 'restart_playlist');
                }

                updateUI();
                return;
            }

            // 2. Process Commands (clear_cache, force_sync, restart_playlist) from Screen or Group
            let needsPlaylistRefetch = false;

            const isClearCache = !!(data.clear_cache || (groupData && groupData.clear_cache));
            const isForceSync = !!(data.force_sync || (groupData && groupData.force_sync));
            const isRestartPlaylist = !!(data.restart_playlist || (groupData && groupData.restart_playlist));

            if (isClearCache) {
                console.log("[Tizen] Clear cache command received.");
                localStorage.removeItem(KEYS.PLAYLIST);
                if (data.clear_cache) await clearScreenCommandOnServer(state.screenId, 'clear_cache');
                if (validGroupId && groupData && groupData.clear_cache) await clearGroupCommandOnServer(validGroupId, 'clear_cache');
                needsPlaylistRefetch = true;
            }

            if (isForceSync) {
                console.log("[Tizen] Force sync command received.");
                localStorage.removeItem(KEYS.PLAYLIST);
                if (data.force_sync) await clearScreenCommandOnServer(state.screenId, 'force_sync');
                if (validGroupId && groupData && groupData.force_sync) await clearGroupCommandOnServer(validGroupId, 'force_sync');
                needsPlaylistRefetch = true;
            }

            if (isRestartPlaylist) {
                console.log("[Tizen] Restart playlist command received.");
                state.currentAssetIndex = 0;
                if (data.restart_playlist) await clearScreenCommandOnServer(state.screenId, 'restart_playlist');
                if (groupData && groupData.restart_playlist) await clearGroupCommandOnServer(data.groupId, 'restart_playlist');
                needsPlaylistRefetch = true;
            }

            // 3. Fetch playlist if valid activePlaylistId exists
            if (activePlaylistId && activePlaylistId !== 'None') {
                if (state.status === 'pairing' || state.status === 'standby') {
                    state.status = 'active';
                    localStorage.setItem(KEYS.STATUS, 'active');
                }
                if (activePlaylistId !== state.playlistId || needsPlaylistRefetch || !state.playlist || state.playlist.length === 0) {
                    state.playlistId = activePlaylistId;
                    localStorage.setItem('signage_tizen_playlist_id', activePlaylistId);
                    await fetchPlaylist(activePlaylistId, state, views, updateUI);
                } else if (hasChanged) {
                    updateUI();
                }
            } else if (hasChanged) {
                updateUI();
            }
        } catch (err) {
            console.error("Error syncing screen configuration:", err);
        }
    }

    function startSyncLoop() {
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(() => {
            if (state.status === 'pairing') {
                checkPairingStatusOnServer(state, updateUI);
            } else if (state.screenId) {
                fetchScreenConfig();
            }
        }, 10000);
    }

    function startHeartbeatLoop() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (state.screenId && state.status !== 'pairing') {
                sendHeartbeatOnServer(state);
            }
        }, 15000);
    }

    function disconnectDevice() {
        console.log("Disconnecting device and resetting pairing.");
        if (state.screenId) {
            logDeviceEvent(state, 'Screen went offline', 'offline', 'Device unlinked or pairing reset');
            reportOfflineOnServer(state.uuid, 'Device unlinked/reset');
        }

        localStorage.removeItem(KEYS.SCREEN_ID);
        localStorage.removeItem(KEYS.PAIRING_CODE);
        localStorage.removeItem(KEYS.STATUS);
        localStorage.removeItem(KEYS.PLAYLIST);
        localStorage.removeItem('signage_tizen_playlist_id');

        state.screenId = '';
        state.pairingCode = '';
        state.status = 'pairing';
        state.isRotating = false;
        state.playlist = [];
        state.playlistId = '';

        updateUI();
        requestPairingCode(state, views, updateUI);
    }

    window.onload = init;
})();
