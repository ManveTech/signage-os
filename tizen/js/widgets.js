/**
 * SignageOS Player - High-Performance Lightweight Overlay Widgets Module
 * Supports: Clock (Background-free typography), Ticker (Website RSS JSON parser + Marquee), and QR Code Overlay.
 * Designed for low-power Samsung Tizen hardware (near-zero CPU/RAM overhead).
 */

window.SignageWidgets = (function () {
    let clockInterval = null;

    // ---- Helper: Website RSS / Ticker Data Unpacker ----------------------

    function extractTickerData(input) {
        let text = '';
        let label = 'WORLD NEWS';

        if (!input) return { text: '', label };

        let parsed = input;

        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (trimmed === '[object Object]' || trimmed === 'object Object') return { text: '', label };

            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    parsed = JSON.parse(trimmed);
                } catch (_) {
                    return { text: trimmed.replace(/\[object Object\]/gi, '').trim(), label };
                }
            } else {
                return { text: trimmed.replace(/\[object Object\]/gi, '').trim(), label };
            }
        }

        if (typeof parsed === 'object' && parsed !== null) {
            // Case 1: Combined website JSON with .rss field
            if (parsed.rss && typeof parsed.rss === 'object') {
                if (parsed.rss.label) label = String(parsed.rss.label);
                if (Array.isArray(parsed.rss.items)) {
                    text = parsed.rss.items.filter(i => i && String(i).trim()).map(i => String(i).trim()).join('   •   ');
                } else if (parsed.rss.text) {
                    text = String(parsed.rss.text);
                }
            }
            // Case 2: Website RSS JSON with .items array
            else if (Array.isArray(parsed.items)) {
                if (parsed.label) label = String(parsed.label);
                text = parsed.items.filter(i => i && String(i).trim()).map(i => String(i).trim()).join('   •   ');
            }
            // Case 3: Flat object or single news item
            else {
                if (parsed.label) label = String(parsed.label);
                const rawVal = parsed.text || parsed.title || parsed.headline || parsed.description || parsed.message || '';
                text = typeof rawVal === 'object' ? extractTickerData(rawVal).text : String(rawVal);
            }
        }

        return {
            text: String(text).replace(/\[object Object\]/gi, '').trim(),
            label: String(label).trim().toUpperCase()
        };
    }

    // ---- Helper: Website QR Link Unpacker --------------------------------

    function extractQrUrl(input) {
        if (!input) return '';
        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (trimmed.startsWith('{')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.qrcode) return String(parsed.qrcode).trim();
                    if (parsed.url) return String(parsed.url).trim();
                    if (parsed.link) return String(parsed.link).trim();
                } catch (_) {}
            }
            return trimmed;
        }
        if (typeof input === 'object' && input !== null) {
            return String(input.qrcode || input.url || input.link || '').trim();
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

    function startTicker(cleanText, label = 'NOTICE') {
        const tickerEl = document.getElementById('widget-ticker');
        const textEl = document.getElementById('ticker-text');
        const labelEl = document.getElementById('ticker-label');

        if (!tickerEl || !textEl) return;

        if (!cleanText || String(cleanText).trim() === '') {
            tickerEl.classList.add('hidden');
            return;
        }

        const displayText = String(cleanText).trim();
        if (labelEl) labelEl.innerText = (label || 'NOTICE').toUpperCase();
        textEl.innerText = displayText;

        // Force reflow to restart CSS marquee animation smoothly
        textEl.style.animation = 'none';
        void textEl.offsetHeight;

        const textLen = displayText.length;
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

        const rawWidgetLink = (currentAsset && currentAsset.widgetLink) ||
                              state.widgetLink ||
                              activePlaylist.widgetLink ||
                              '';

        const rawTickerText = (currentAsset && currentAsset.tickerText) ||
                              state.tickerText ||
                              activePlaylist.tickerText ||
                              rawWidgetLink ||
                              '';

        const defaultLabel = (currentAsset && currentAsset.tickerLabel) ||
                             state.tickerLabel ||
                             activePlaylist.tickerLabel ||
                             'NOTICE';

        const tickerData = extractTickerData(rawTickerText);
        if (!tickerData.label || tickerData.label === 'WORLD NEWS') {
            tickerData.label = defaultLabel;
        }

        const cleanQrUrl = extractQrUrl(rawWidgetLink);
        const overlayEl = document.getElementById('widgets-overlay');

        // 1. Ticker / RSS Widget
        if (activeTypes.has('ticker') && tickerData.text) {
            if (overlayEl) overlayEl.classList.add('has-ticker');
            startTicker(tickerData.text, tickerData.label);
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
            let qrUrl = cleanQrUrl;
            if (!qrUrl) {
                const domain = window.location.hostname || 'tizen.manve.co';
                qrUrl = `http://${domain}`;
            }

            let qrPlacement = widgetPlacement;
            if (activeTypes.has('clock')) {
                if (widgetPlacement === 'top-right') qrPlacement = 'bottom-right';
                else if (widgetPlacement === 'top-left') qrPlacement = 'bottom-left';
                else if (widgetPlacement === 'bottom-right') qrPlacement = 'top-right';
                else if (widgetPlacement === 'bottom-left') qrPlacement = 'top-left';
            }
            startQR(qrUrl, qrPlacement);
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
