/**
 * SignageOS Player - Remote Keys & Control Handler Module
 */

window.SignageKeys = (function () {
    function bindRemoteKeys(views, onRequestPairingCode) {
        if (views.refreshCodeBtn) {
            views.refreshCodeBtn.addEventListener('click', () => {
                views.refreshCodeBtn.disabled = true;
                views.refreshCodeBtn.innerText = "Requesting...";
                onRequestPairingCode().finally(() => {
                    views.refreshCodeBtn.disabled = false;
                    views.refreshCodeBtn.innerText = "Get New Code";
                });
            });
        }

        window.addEventListener('keydown', (e) => {
            const keyCode = e.keyCode;
            const isPairingScreenActive = views.pairing && views.pairing.classList.contains('active');

            if (isPairingScreenActive) {
                if (document.activeElement !== views.refreshCodeBtn && views.refreshCodeBtn) {
                    views.refreshCodeBtn.focus();
                }

                if (keyCode === 13 || keyCode === 29443 || keyCode === 10190 || e.key === 'Enter') {
                    e.preventDefault();
                    if (views.refreshCodeBtn) views.refreshCodeBtn.click();
                }
            }
        });
    }

    return {
        bindRemoteKeys
    };
})();
