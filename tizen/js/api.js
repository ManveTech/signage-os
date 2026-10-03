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

    /**
     * This TV's own screen record, through the server (verified by hardware
     * id). The player used to read it straight from PocketBase, which only
     * admins can read — so every read failed, and a failure was treated as
     * "removed": TVs being paired kept discarding their code, and paired TVs
     * disconnected themselves.
     *   { ok: true, data }   — the record
     *   { unpaired: true }   — the server says this TV no longer owns a screen
     *   { ok: false }        — temporary problem; keep going as before
     */
    async function fetchDeviceScreen(state) {
        try {
            const res = await fetchWithTimeout(`${SERVER_URL}/api/v1/devices/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ screenId: state.screenId, hardwareUuid: state.uuid })
            }, 5000);
            const body = await res.json().catch(() => ({}));
            if (res.ok) return { ok: true, data: body };
            if ((res.status === 404 || res.status === 403) && body && body.unpaired === true) return { unpaired: true };
            return { ok: false };
        } catch (e) {
            return { ok: false };
        }
    }

    async function clearScreenCommandOnServer(screenId, command) {
        try {
            // /devices/clear-command was removed from the server; /devices/ack
            // is the verified replacement.
            await fetchWithTimeout(`${SERVER_URL}/api/v1/devices/ack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    screenId: screenId,
                    hardwareUuid: localStorage.getItem(KEYS.UUID) || '',
                    clear: [command]
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

        const result = await fetchDeviceScreen(state);
        if (result.ok) {
            const data = result.data;
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
        } else if (result.unpaired) {
            console.warn("Screen record gone on server. Requesting a new pairing code.");
            state.screenId = '';
            state.pairingCode = '';
            localStorage.removeItem(KEYS.SCREEN_ID);
            localStorage.removeItem(KEYS.PAIRING_CODE);
            requestPairingCode(state, window.viewsRef || {}, updateUICallback, true);
        }
    }

    async function reportOfflineOnServer(uuid, reason = 'App closed') {
        try {
            const payload = JSON.stringify({ hardwareUuid: uuid, reason });
            if (navigator.sendBeacon) {
                navigator.sendBeacon(`${SERVER_URL}/api/v1/devices/offline`, payload);
            } else {
                fetch(`${SERVER_URL}/api/v1/devices/offline`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    keepalive: true
                }).catch(() => {});
            }
        } catch (_) {}
    }

    async function clearGroupCommandOnServer(groupId, command) {
        if (!groupId || !command) return;
        try {
            const POCKETBASE_URL = getPocketBaseUrl();
            const url = `${POCKETBASE_URL}/api/collections/screen_groups/records/${groupId}`;
            const bodyData = {};
            bodyData[command] = false;
            await fetchWithTimeout(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            }, 3000);
        } catch (e) {
            console.error(`Failed to clear group command ${command} on server:`, e);
        }
    }

    async function sendHeartbeatOnServer(state) {
        if (!state || (!state.screenId && !state.uuid)) return;
        if (window.navigator && window.navigator.onLine === false) return;

        try {
            let storageUsedBytes = 0;
            let storageAvailableBytes = 10737418240; // 10GB default
            if (navigator.storage && navigator.storage.estimate) {
                try {
                    const estimate = await navigator.storage.estimate();
                    if (estimate) {
                        storageUsedBytes = estimate.usage || 0;
                        if (estimate.quota) storageAvailableBytes = Math.max(0, estimate.quota - storageUsedBytes);
                    }
                } catch (_) {}
            }

            let currentAsset = 'None';
            if (state.playlist && state.playlist.length > 0) {
                const current = state.playlist[state.currentAssetIndex || 0];
                if (current) currentAsset = current.filename || current.id || 'Media Asset';
            }

            const payload = {
                hardwareUuid: state.uuid,
                screenId: state.screenId || null,
                // Only real readings — this used to report a made-up 42°C.
                cpuTemp: state.cpuTemp || null,
                currentPlayingAsset: currentAsset,
                storageUsedBytes: storageUsedBytes,
                storageAvailableBytes: storageAvailableBytes
            };

            await fetchWithTimeout(`${SERVER_URL}/api/v1/devices/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }, 10000).catch(() => {});
        } catch (err) {
            console.warn("[Heartbeat] Failed to send heartbeat:", err.message);
        }
    }

    async function logDeviceEvent(state, event, type, detail) {
        if (!state || !state.screenId) return;
        try {
            // screen_logs isn't writable from a device; /devices/log is the
            // verified endpoint (these posts used to be rejected).
            const payload = {
                screenId: state.screenId,
                hardwareUuid: state.uuid,
                event: event,
                type: ['error', 'sync', 'other'].includes(type) ? type : 'other',
                detail: detail || ''
            };

            await fetchWithTimeout(`${SERVER_URL}/api/v1/devices/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }, 3000).catch(() => {});
        } catch (e) {
            console.warn("[Log] Failed to send device log:", e.message);
        }
    }

    return {
        fetchWithTimeout,
        fetchDeviceScreen,
        clearScreenCommandOnServer,
        clearGroupCommandOnServer,
        requestPairingCode,
        checkPairingStatusOnServer,
        reportOfflineOnServer,
        sendHeartbeatOnServer,
        logDeviceEvent
    };
})();
