/**
 * SignageOS Player - High-Performance Lightweight Overlay Widgets Module
 * Supports: Clock (Background-free typography), Ticker (JSON text parser + Marquee), and QR Code Overlay.
 * Designed for low-power Samsung Tizen hardware (near-zero CPU/RAM overhead).
 */

window.SignageWidgets = (function () {
    let clockInterval = null;

    // ---- Helper: Extract Plain Text from JSON / Objects for News/Ticker ---

    function extractTickerText(input) {
        if (!input) return '';

        let obj = input;

        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (trimmed === '[object Object]' || trimmed === 'object Object') return '';

            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
                trimmed.includes('{') || trimmed.includes(':')) {
                try {
                    obj = JSON.parse(trimmed);
                } catch (_) {
                    return trimmed.replace(/\[object Object\]/gi, '').trim();
                }
            } else {
                return trimmed.replace(/\[object Object\]/gi, '').trim();
            }
        }

        function walk(target) {
            if (!target) return [];
            if (typeof target === 'string' || typeof target === 'number') {
                const s = String(target).replace(/\[object Object\]/gi, '').trim();
                return (s && s !== '[object Object]' && s !== 'object Object') ? [s] : [];
            }
            if (Array.isArray(target)) {
                let res = [];
                target.forEach(item => {
                    res = res.concat(walk(item));
                });
                return res;
            }
            if (typeof target === 'object') {
                const priorityKeys = ['text', 'title', 'headline', 'message', 'content', 'value', 'name', 'paragraph', 'label'];
                for (const key of priorityKeys) {
                    if (target[key]) {
                        const found = walk(target[key]);
                        if (found.length > 0) return found;
                    }
                }
                const containerKeys = ['paragraphs', 'items', 'news', 'headlines', 'data', 'slides'];
                for (const key of containerKeys) {
                    if (target[key]) {
                        const found = walk(target[key]);
                        if (found.length > 0) return found;
                    }
                }
                let res = [];
                Object.keys(target).forEach(k => {
                    if (target[k] && typeof target[k] !== 'function') {
                        res = res.concat(walk(target[k]));
                    }
                });
                return res;
            }
            return [];
        }

        const extracted = walk(obj).filter(t => t && t !== '[object Object]' && t !== 'object Object');
        if (extracted.length > 0) {
            const unique = Array.from(new Set(extracted));
            return unique.join('   •   ');
        }

        return '';
    }

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

    function startTicker(rawText, label = 'NOTICE') {
        const tickerEl = document.getElementById('widget-ticker');
        const textEl = document.getElementById('ticker-text');
        const labelEl = document.getElementById('ticker-label');

        if (!tickerEl || !textEl) return;

        const cleanText = extractTickerText(rawText);
        if (!cleanText || cleanText.trim() === '') {
            tickerEl.classList.add('hidden');
            return;
        }

        if (labelEl) labelEl.innerText = (label || 'NOTICE').toUpperCase();
        textEl.innerText = cleanText;

        // Force reflow to restart CSS marquee animation smoothly
        textEl.style.animation = 'none';
        void textEl.offsetHeight;

        const textLen = cleanText.length;
        const durationSec = Math.max(12, Math.min(60, Math.round(textLen * 0.3)));
        textEl.style.animation = `marquee-scroll ${durationSec}s linear infinite`;

        tickerEl.classList.remove('hidden');
    }

    function stopTicker() {
        const tickerEl = document.getElementById('widget-ticker');
        if (tickerEl) tickerEl.classList.add('hidden');
    }

    // ---- QR Code Widget (SVG / Vector Renderer) --------------------------

    function generateQrSvg(text) {
        if (!text) return '';
        const encodedUrl = encodeURIComponent(text);
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodedUrl}`;
        return `<img src="${qrApiUrl}" alt="QR Code" style="width: 90px; height: 90px; display: block; border-radius: 6px; background: #ffffff;" />`;
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

    // ---- Helper: Flexible Type Normalizer --------------------------------

    function parseWidgetTypes(rawInput) {
        let items = [];
        if (Array.isArray(rawInput)) {
            items = rawInput.map(s => String(s).toLowerCase().trim());
        } else if (typeof rawInput === 'string' && rawInput.trim()) {
            items = rawInput.toLowerCase().split(',').map(s => s.trim());
        }

        const normalized = new Set();
        items.forEach(t => {
            if (t === 'clock' || t === 'time') normalized.add('clock');
            if (t === 'ticker' || t === 'rss' || t === 'news' || t === 'announcement') normalized.add('ticker');
            if (t === 'qr' || t === 'qrcode' || t === 'scan') normalized.add('qr');
        });
        return normalized;
    }

    // ---- Unified Widgets Synchronization Logic ---------------------------

    function syncWidgets(state, currentAsset) {
        if (!state) return;

        const activePlaylist = state.activePlaylistObj || {};

        const rawWidgetType = (currentAsset && currentAsset.widgetType) ||
                              state.widgetType ||
                              activePlaylist.widgetType ||
                              '';

        const activeTypes = parseWidgetTypes(rawWidgetType);

        const widgetPlacement = (currentAsset && currentAsset.widgetPlacement) ||
                                state.widgetPlacement ||
                                activePlaylist.widgetPlacement ||
                                'top-right';

        let widgetLink = (currentAsset && currentAsset.widgetLink) ||
                         state.widgetLink ||
                         activePlaylist.widgetLink ||
                         '';

        let tickerText = (currentAsset && currentAsset.tickerText) ||
                         state.tickerText ||
                         activePlaylist.tickerText ||
                         widgetLink ||
                         '';

        const tickerLabel = (currentAsset && currentAsset.tickerLabel) ||
                            state.tickerLabel ||
                            activePlaylist.tickerLabel ||
                            'NOTICE';

        const overlayEl = document.getElementById('widgets-overlay');

        // 1. Ticker Widget
        if (activeTypes.has('ticker') && tickerText.trim()) {
            if (overlayEl) overlayEl.classList.add('has-ticker');
            startTicker(tickerText, tickerLabel);
        } else {
            if (overlayEl) overlayEl.classList.remove('has-ticker');
            stopTicker();
        }

        // 2. Clock Widget
        if (activeTypes.has('clock')) {
            startClock(widgetPlacement);
        } else {
            stopClock();
        }

        // 3. QR Code Widget
        if (activeTypes.has('qr')) {
            if (!widgetLink || widgetLink.trim() === '') {
                const domain = window.location.hostname || 'tizen.manve.co';
                widgetLink = `http://${domain}`;
            }

            let qrPlacement = widgetPlacement;
            if (activeTypes.has('clock')) {
                if (widgetPlacement === 'top-right') qrPlacement = 'bottom-right';
                else if (widgetPlacement === 'top-left') qrPlacement = 'bottom-left';
                else if (widgetPlacement === 'bottom-right') qrPlacement = 'top-right';
                else if (widgetPlacement === 'bottom-left') qrPlacement = 'top-left';
            }
            startQR(widgetLink, qrPlacement);
        } else {
            stopQR();
        }
    }

    function hideAllWidgets() {
        stopClock();
        stopTicker();
        stopQR();
        const overlayEl = document.getElementById('widgets-overlay');
        if (overlayEl) overlayEl.classList.remove('has-ticker');
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
