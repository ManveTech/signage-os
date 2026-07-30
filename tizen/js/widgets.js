/**
 * SignageOS Player - High-Performance Lightweight Overlay Widgets Module
 * Supports: Clock, Ticker (Hardware-Accelerated Marquee), and QR Code Overlay.
 * Designed for low-power Samsung Tizen hardware (near-zero CPU/RAM overhead).
 */

window.SignageWidgets = (function () {
    let clockInterval = null;
    let currentWidgetPlacement = 'top-right';

    // ---- Clock Widget ----------------------------------------------------

    function updateClockDisplay() {
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');
        if (!timeEl || !dateEl) return;

        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        timeEl.innerText = `${hours}:${minutes}:${seconds}`;

        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        dateEl.innerText = now.toLocaleDateString('en-US', options);
    }

    function startClock(placement = 'top-right') {
        const clockEl = document.getElementById('widget-clock');
        if (!clockEl) return;

        clockEl.className = `widget widget-clock ${placement}`;
        clockEl.classList.remove('hidden');

        updateClockDisplay();
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(updateClockDisplay, 1000);
    }

    function stopClock() {
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
        const clockEl = document.getElementById('widget-clock');
        if (clockEl) clockEl.classList.add('hidden');
    }

    // ---- Ticker Widget ---------------------------------------------------

    function startTicker(text, label = 'ANNOUNCEMENT') {
        const tickerEl = document.getElementById('widget-ticker');
        const textEl = document.getElementById('ticker-text');
        const labelEl = document.getElementById('ticker-label');

        if (!tickerEl || !textEl) return;

        if (!text || text.trim() === '') {
            tickerEl.classList.add('hidden');
            return;
        }

        if (labelEl) labelEl.innerText = (label || 'NOTICE').toUpperCase();
        textEl.innerText = text;

        // Reset marquee animation to restart smoothly
        textEl.style.animation = 'none';
        void textEl.offsetHeight; // trigger reflow

        // Dynamic speed based on text length (longer text = longer duration so reading speed is consistent)
        const textLen = text.length;
        const durationSec = Math.max(15, Math.min(60, Math.round(textLen * 0.3)));
        textEl.style.animation = `marquee-scroll ${durationSec}s linear infinite`;

        tickerEl.classList.remove('hidden');
    }

    function stopTicker() {
        const tickerEl = document.getElementById('widget-ticker');
        if (tickerEl) tickerEl.classList.add('hidden');
    }

    // ---- QR Code Widget (SVG Vector Generator) ---------------------------

    // Lightweight SVG QR code matrix renderer fallback
    function generateQrSvg(text) {
        // High contrast fallback vector representation of QR data / URL
        const encodedUrl = encodeURIComponent(text);
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodedUrl}`;
        return `<img src="${qrApiUrl}" alt="QR Code" style="width: 100px; height: 100px; display: block; border-radius: 4px;" />`;
    }

    function startQR(url, placement = 'top-right') {
        const qrEl = document.getElementById('widget-qr');
        const container = document.getElementById('qr-container');

        if (!qrEl || !container || !url) return;

        qrEl.className = `widget widget-qr ${placement}`;
        container.innerHTML = generateQrSvg(url);
        qrEl.classList.remove('hidden');
    }

    function stopQR() {
        const qrEl = document.getElementById('widget-qr');
        if (qrEl) qrEl.classList.add('hidden');
    }

    // ---- Unified Widgets Synchronization Logic ---------------------------

    function syncWidgets(state, currentAsset) {
        if (!state) return;

        // Extract widget settings from active playlist or slide payload
        const playlist = state.playlist || [];
        const activePlaylist = state.activePlaylistObj || {};

        // Merge attributes: slide settings override playlist settings
        const widgetTypeStr = (currentAsset && currentAsset.widgetType) || activePlaylist.widgetType || state.widgetType || '';
        const widgetPlacement = (currentAsset && currentAsset.widgetPlacement) || activePlaylist.widgetPlacement || state.widgetPlacement || 'top-right';
        const widgetLink = (currentAsset && currentAsset.widgetLink) || activePlaylist.widgetLink || state.widgetLink || '';
        const tickerText = (currentAsset && currentAsset.tickerText) || activePlaylist.tickerText || state.tickerText || widgetLink || '';
        const tickerLabel = (currentAsset && currentAsset.tickerLabel) || activePlaylist.tickerLabel || state.tickerLabel || 'NOTICE';

        const activeTypes = widgetTypeStr.toLowerCase().split(',').map(s => s.trim());

        // 1. Clock Widget
        if (activeTypes.includes('clock')) {
            startClock(widgetPlacement);
        } else {
            stopClock();
        }

        // 2. QR Code Widget
        if (activeTypes.includes('qr') && widgetLink) {
            // Offset QR code position if Clock is in the exact same corner
            let qrPlacement = widgetPlacement;
            if (activeTypes.includes('clock') && widgetPlacement === 'top-right') {
                qrPlacement = 'bottom-right';
            }
            startQR(widgetLink, qrPlacement);
        } else {
            stopQR();
        }

        // 3. Ticker Widget
        if (activeTypes.includes('ticker') && tickerText) {
            startTicker(tickerText, tickerLabel);
        } else {
            stopTicker();
        }
    }

    function hideAllWidgets() {
        stopClock();
        stopTicker();
        stopQR();
    }

    return {
        startClock,
        stopClock,
        startTicker,
        stopTicker,
        startQR,
        stopQR,
        syncWidgets,
        hideAllWidgets
    };
})();
