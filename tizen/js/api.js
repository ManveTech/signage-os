/**
 * SignageOS Player - API & Server Communication Module
 */

window.SignageApi = (function () {
    const { SERVER_URL, KEYS, getPocketBaseUrl, setPocketBaseUrl } = window.SignageConfig;

    function fetchWithTimeout(url, options = {}, timeout = 3000) {
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

    async function requestPairingCode(state, views, updateUICallback, forceRefresh = false) {
        try {
            if (views.pairingStatusMsg) views.pairingStatusMsg.innerText = "Requesting code...";
            const res = await fetch(`${SERVER_URL}/api/v1/devices/pairing-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hardwareUuid: state.uuid,
                    forceRefresh: !!forceRefresh
                })
            });

            if (!res.ok) throw new Error('API pairing code call failed');
            const data = await res.json();

            state.pairingCode = data.pairingCode;
            state.screenId = data.screenId;
            state.status = data.status || 'pairing';
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
                if (data.pairing_code && data.pairing_code !== state.pairingCode) {
                    state.pairingCode = data.pairing_code;
                    localStorage.setItem(KEYS.PAIRING_CODE, state.pairingCode);
                    if (updateUICallback) updateUICallback();
                }
                if (data.status && data.status !== 'pairing') {
                    console.log("Device paired successfully!");
                    state.status = data.status;
                    localStorage.setItem(KEYS.STATUS, state.status);
                    if (updateUICallback) updateUICallback();
                }
            } else if (res.status === 404 || res.status === 403) {
                console.warn("Screen record missing on server. Resetting pairing.");
                state.screenId = '';
                state.pairingCode = '';
                localStorage.removeItem(KEYS.SCREEN_ID);
                localStorage.removeItem(KEYS.PAIRING_CODE);
                requestPairingCode(state, window.viewsRef || {}, updateUICallback, true);
            }
        } catch (err) {
            console.error("Error checking pairing status:", err);
        }
    }

    return {
        fetchWithTimeout,
        clearScreenCommandOnServer,
        requestPairingCode,
        checkPairingStatusOnServer
    };
})();
