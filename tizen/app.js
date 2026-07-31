/**
 * SignageOS Player - Tizen Web Client Engine
 */

(function () {
    const { KEYS, getPocketBaseUrl } = window.SignageConfig;
    const { getOrGenerateUUID } = window.SignageStorage;
    const { requestPairingCode, checkPairingStatusOnServer, clearScreenCommandOnServer, fetchWithTimeout, reportOfflineOnServer } = window.SignageApi;
    const { startPlaylistRotation, fetchPlaylist, stopAndUnloadVideo } = window.SignagePlayer;
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
                if (stopAndUnloadVideo && views.videoPlayer) stopAndUnloadVideo(views.videoPlayer);
                if (views.pairingCodeText) views.pairingCodeText.innerText = state.pairingCode || '------';
                if (views.pairing) views.pairing.classList.add('active');
                state.isRotating = false;
                break;
            case 'active':
            case 'online':
            case 'offline':
                if (!state.playlist || state.playlist.length === 0) {
                    if (window.SignageWidgets) window.SignageWidgets.hideAllWidgets();
                    if (stopAndUnloadVideo && views.videoPlayer) stopAndUnloadVideo(views.videoPlayer);
                    state.isRotating = false;
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
                if (stopAndUnloadVideo && views.videoPlayer) stopAndUnloadVideo(views.videoPlayer);
                state.isRotating = false;
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

            if (data.force_sync || data.clear_cache) {
                localStorage.removeItem(KEYS.PLAYLIST);
                state.playlist = [];
                state.currentAssetIndex = 0;
                hasChanged = true;
                await clearScreenCommandOnServer(state.screenId, data.force_sync ? 'force_sync' : 'clear_cache');
            }

            if (data.restart_playlist) {
                state.currentAssetIndex = 0;
                hasChanged = true;
                await clearScreenCommandOnServer(state.screenId, 'restart_playlist');
                startPlaylistRotation(state, views, updateUI);
            }

            let activePlaylistId = data.playlistId || data.playlist;
            if (data.schedulePlaylist && data.scheduleDate && data.scheduleTime) {
                if (isScheduleDue(data.scheduleDate, data.scheduleTime)) {
                    activePlaylistId = data.schedulePlaylist;
                }
            }

            const isNone = !activePlaylistId || activePlaylistId === 'None';
            if ((state.status === "active" || state.status === "online") && !isNone) {
                state.playlistId = activePlaylistId;
                localStorage.setItem('signage_tizen_playlist_id', activePlaylistId);
                await fetchPlaylist(activePlaylistId, state, views, updateUI);
            } else if (isNone && state.playlist && state.playlist.length > 0) {
                state.playlist = [];
                state.playlistId = '';
                localStorage.setItem(KEYS.PLAYLIST, '[]');
                localStorage.removeItem('signage_tizen_playlist_id');
                if (stopAndUnloadVideo && views.videoPlayer) stopAndUnloadVideo(views.videoPlayer);
                if (window.SignagePlayer && window.SignagePlayer.syncLocalFiles) window.SignagePlayer.syncLocalFiles([]);
                hasChanged = true;
            }

            if (hasChanged) {
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
