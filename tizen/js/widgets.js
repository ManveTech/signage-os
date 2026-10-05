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
        // null = no badge text was saved (old tickers); '' = left blank on purpose.
        let label = null;

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
                if (typeof parsed.rss.label === 'string') label = parsed.rss.label;
                if (Array.isArray(parsed.rss.items)) {
                    text = parsed.rss.items.filter(i => i && String(i).trim()).map(i => String(i).trim()).join('   •   ');
                } else if (parsed.rss.text) {
                    text = String(parsed.rss.text);
                }
            }
            // Case 2: Website RSS JSON with .items array
            else if (Array.isArray(parsed.items)) {
                if (typeof parsed.label === 'string') label = parsed.label;
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
            label: label === null ? null : String(label).trim().toUpperCase()
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
                    return ''; // JSON for other widgets, no QR link in it
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

    // India time, whatever time zone the TV is set to (same as Android TV).
    const IST_OFFSET_MS = 330 * 60000;
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function updateClockDisplay() {
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');
        if (!timeEl || !dateEl) return;

        const ist = new Date(Date.now() + IST_OFFSET_MS);
        const h = ist.getUTCHours(), m = ist.getUTCMinutes();
        timeEl.innerHTML = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}<span class="clock-ampm">${h < 12 ? 'AM' : 'PM'}</span>`;
        dateEl.innerText = `${DAYS[ist.getUTCDay()]}, ${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
    }

    function startClock(placement = 'top-right', label = '') {
        const clockEl = document.getElementById('widget-clock');
        if (!clockEl) return;

        clockEl.className = `widget widget-clock ${placement}`;
        clockEl.classList.remove('hidden');
        const labelEl = document.getElementById('clock-label');
        if (labelEl) {
            labelEl.innerText = String(label || '').trim().toUpperCase();
            labelEl.classList.toggle('hidden', !String(label || '').trim());
        }

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
        if (labelEl) {
            labelEl.innerText = String(label || '').toUpperCase();
            labelEl.style.display = label ? '' : 'none';
        }
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

    // Drawn here on the TV (js/vendor/qrcode.js), so it works offline and
    // the link isn't sent to an outside QR service.
    function generateQrSvg(text) {
        if (!text || typeof qrcode !== 'function') return '';
        try {
            qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
            const qr = qrcode(0, 'M');
            qr.addData(String(text));
            qr.make();
            return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
        } catch (e) {
            console.warn('[Widgets] QR code failed:', e);
            return '';
        }
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


        const tickerData = extractTickerData(rawTickerText);
        if (tickerData.label === null) tickerData.label = 'NEWS';

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

        // 2. Clock Widget — its label is widgetLink's "clock" (several
        // widgets on) or the plain widgetLink (the clock on its own).
        if (activeTypes.has('clock')) {
            let clockLabel = '';
            const linkStr = typeof rawWidgetLink === 'string' ? rawWidgetLink.trim() : '';
            if (rawWidgetLink && typeof rawWidgetLink === 'object') {
                clockLabel = typeof rawWidgetLink.clock === 'string' ? rawWidgetLink.clock : '';
            } else if (linkStr.startsWith('{')) {
                try { const p = JSON.parse(linkStr); clockLabel = typeof p.clock === 'string' ? p.clock : ''; } catch (_) {}
            } else if (activeTypes.size === 1) {
                clockLabel = linkStr;
            }
            startClock(widgetPlacement, clockLabel);
        } else {
            stopClock();
        }

        // 3. QR Code Widget
        // Nothing to show until a link is set (it used to show a code for
        // the player's own address).
        if (activeTypes.has('qr') && cleanQrUrl) {
            const qrUrl = cleanQrUrl;

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
