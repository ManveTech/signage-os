/**
 * SignageOS Player - Tizen Web Client Engine
 */

(function () {
    const { KEYS, getPocketBaseUrl } = window.SignageConfig;
    const { getOrGenerateUUID } = window.SignageStorage;
    const { requestPairingCode, checkPairingStatusOnServer, clearScreenCommandOnServer, fetchWithTimeout, reportOfflineOnServer } = window.SignageApi;
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
        isRotating: false
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

        window.addEventListener('beforeunload', () => {
            if (state.uuid) reportOfflineOnServer(state.uuid, 'Tizen app unmounted');
        });

        if (state.screenId && state.status !== 'pairing') {
            // Offline-first: paint the cached playlist immediately so the screen
            // starts looping without waiting on (or needing) the network. The
            // background sync below refreshes config and hot-swaps on changes.
            updateUI();
            fetchScreenConfig();
        } else {
            requestPairingCode(state, views, updateUI);
        }

        startSyncLoop();
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

            let activePlaylistId = data.playlistId || data.playlist;
            if (data.schedulePlaylist && data.scheduleDate && data.scheduleTime) {
                if (isScheduleDue(data.scheduleDate, data.scheduleTime)) {
                    activePlaylistId = data.schedulePlaylist;
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

                updateUI();
                return;
            }

            // 2. Process Bulk Commands (clear_cache, force_sync, restart_playlist)
            let needsPlaylistRefetch = false;

            if (data.clear_cache) {
                console.log("[Tizen] Clear cache command received.");
                localStorage.removeItem(KEYS.PLAYLIST);
                if (window.SignagePlayer && window.SignagePlayer.syncLocalFiles) {
                    await window.SignagePlayer.syncLocalFiles([]);
                }
                await clearScreenCommandOnServer(state.screenId, 'clear_cache');
                needsPlaylistRefetch = true;
            }

            if (data.force_sync) {
                console.log("[Tizen] Force sync command received.");
                localStorage.removeItem(KEYS.PLAYLIST);
                if (window.SignagePlayer && window.SignagePlayer.syncLocalFiles) {
                    await window.SignagePlayer.syncLocalFiles([]);
                }
                await clearScreenCommandOnServer(state.screenId, 'force_sync');
                needsPlaylistRefetch = true;
            }

            if (data.restart_playlist) {
                console.log("[Tizen] Restart playlist command received.");
                state.currentAssetIndex = 0;
                await clearScreenCommandOnServer(state.screenId, 'restart_playlist');
                needsPlaylistRefetch = true;
            }

            // 3. Fetch playlist if ID changed, command demanded refetch, or local playlist is empty
            if ((state.status === "active" || state.status === "online") && (activePlaylistId !== state.playlistId || needsPlaylistRefetch || !state.playlist || state.playlist.length === 0)) {
                state.playlistId = activePlaylistId;
                localStorage.setItem('signage_tizen_playlist_id', activePlaylistId);
                await fetchPlaylist(activePlaylistId, state, views, updateUI);
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

    function disconnectDevice() {
        console.log("Disconnecting device and resetting pairing.");
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
