/**
 * SignageOS Player - Branding & Theme Module
 */

window.SignageBranding = (function () {
    function applyBranding(state, views) {
        const defaultLogo = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230ea5e9'><path d='M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z'/></svg>";
        const logoUrl = (state.branding && state.branding.isWhiteLabel && state.branding.logoUrl) 
            ? state.branding.logoUrl 
            : defaultLogo;

        if (views.splashLogo) views.splashLogo.src = logoUrl;
        if (views.pairingLogo) views.pairingLogo.src = logoUrl;
        if (views.standbyLogo) views.standbyLogo.src = logoUrl;

        if (state.branding && state.branding.isWhiteLabel && state.branding.name) {
            if (views.splashName) views.splashName.innerText = state.branding.name;
            const standbyTitle = document.getElementById('standby-title');
            const standbyDesc = document.getElementById('standby-desc');
            if (standbyTitle) standbyTitle.innerText = `READY FOR ${state.branding.name.toUpperCase()} CONTENT`;
            if (standbyDesc) standbyDesc.innerText = "Assign playlist from Whitelabel CMS Portal.";
        } else {
            const standbyTitle = document.getElementById('standby-title');
            const standbyDesc = document.getElementById('standby-desc');
            if (standbyTitle) standbyTitle.innerText = "Standby Mode";
            if (standbyDesc) standbyDesc.innerText = "No playlist assigned to this screen. Please assign a playlist from the SignageOS Dashboard.";
        }
    }

    return {
        applyBranding
    };
})();
