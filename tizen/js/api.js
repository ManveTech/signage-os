/**
 * SignageOS Player - Backend Network API & Sync Module
 */

window.SignageApi = (function () {
    const { SERVER_URL, KEYS, getPocketBaseUrl, setPocketBaseUrl } = window.SignageConfig;

    function fetchWithTimeout(url, options = {}, timeout = 2500) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Request timeout")), timeout);
            })
        ]);
    }

    async function clearScreenCommandOnServer(screenId, command) {
        try {
            await fetchWithTimeout(`${SERVER_URL}/api/v1/devices/clear-command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    screenId: screenId,
                    command: command
                })
            }, 3000);
        } catch (e) {
            console.error(`Failed to clear command ${command} on server:`, e);
        }
    }

    async function requestPairingCode(state, views, updateUICallback) {
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
                setPocketBaseUrl(data.pocketbaseUrl);
            }

            localStorage.setItem(KEYS.PAIRING_CODE, state.pairingCode);
            localStorage.setItem(KEYS.SCREEN_ID, state.screenId);
            localStorage.setItem(KEYS.STATUS, state.status);

            if (views.pairingCodeText) views.pairingCodeText.innerText = state.pairingCode;
            if (views.pairingStatusMsg) views.pairingStatusMsg.innerText = "Awaiting pairing from dashboard...";
            if (updateUICallback) updateUICallback();
        } catch (err) {
            console.error("Error fetching pairing code:", err);
            if (views.pairingStatusMsg) views.pairingStatusMsg.innerText = "Connection failed. Retrying...";
        }
    }

    async function checkPairingStatusOnServer(state, updateUICallback) {
        if (!state.screenId) return;
        if (window.navigator && window.navigator.onLine === false) return;

        try {
            const POCKETBASE_URL = getPocketBaseUrl();
            const url = `${POCKETBASE_URL}/api/collections/screens/records/${state.screenId}`;
            const res = await fetchWithTimeout(url, {}, 2500);
            if (res.ok) {
                const data = await res.json();
                if (data.status && data.status !== 'pairing') {
                    console.log("Device has been successfully paired!");
                    state.status = data.status;
                    localStorage.setItem(KEYS.STATUS, state.status);
                    if (updateUICallback) updateUICallback();
                }
            }
        } catch (err) {
            console.error("Error checking pairing status:", err);
        }
    }

    async function sendHeartbeat(state) {
        if (state.status === 'pairing' || !state.screenId) return;
        if (window.navigator && window.navigator.onLine === false) return;

        try {
            const currentAsset = state.playlist[state.currentAssetIndex];
            const payload = {
                hardwareUuid: state.uuid,
                cpuTemp: 45.0,
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

    async function reportError(state, event, detail) {
        if (!state.screenId) return;
        try {
            const POCKETBASE_URL = getPocketBaseUrl();
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

    return {
        fetchWithTimeout,
        clearScreenCommandOnServer,
        requestPairingCode,
        checkPairingStatusOnServer,
        sendHeartbeat,
        reportError
    };
})();
