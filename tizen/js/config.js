/**
 * SignageOS Player - Configuration & Endpoints Module
 */

window.SignageConfig = (function () {
    const SERVER_URL = 'https://dem1.manve.co';
    let POCKETBASE_URL = localStorage.getItem('signage_tizen_pb_url') || 'https://demo.manve.co';

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

    function getPocketBaseUrl() {
        return POCKETBASE_URL;
    }

    function setPocketBaseUrl(url) {
        if (url) {
            POCKETBASE_URL = url.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname);
            localStorage.setItem('signage_tizen_pb_url', POCKETBASE_URL);
        }
    }

    return {
        SERVER_URL,
        KEYS,
        getPocketBaseUrl,
        setPocketBaseUrl
    };
})();
