/**
 * SignageOS Player - Storage Utility Module
 */

window.SignageStorage = (function () {
    const { KEYS } = window.SignageConfig;

    function getOrGenerateUUID() {
        let uuid = localStorage.getItem(KEYS.UUID);
        if (!uuid) {
            uuid = 'tizen-uuid-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem(KEYS.UUID, uuid);
        }
        return uuid;
    }

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

    return {
        getOrGenerateUUID,
        getFileURI
    };
})();
