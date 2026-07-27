/**
 * SignageOS Player - Overlay Widgets Module (Clock, Weather, RSS, QR Code)
 */

window.SignageWidgets = (function () {
    let clockInterval = null;

    function renderWidgets(state, widgets, SERVER_URL) {
        const w = state.widget;
        if (!w || !w.type) return;

        console.log("Rendering widget overlay:", w.type, w.placement);
        const activeTypes = w.type.split(',').map(s => s.trim().toLowerCase());

        const placement = w.placement || 'top-right';
        [widgets.qrcode, widgets.weather, widgets.clock].forEach(el => {
            if (el) {
                el.className = 'widget-item ' + (el.id === 'widget-qrcode' ? '' : 'card hud') + ' ' + placement + ' hidden';
            }
        });
        if (widgets.rss) {
            widgets.rss.className = 'rss-ticker-container hidden';
        }

        let qrcodeLink = w.link;
        let rssLink = w.link;
        let weatherLink = w.link;
        let clockLink = w.link;

        if (w.link && w.link.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(w.link);
                if (parsed.qrcode) qrcodeLink = parsed.qrcode;
                if (parsed.rss) rssLink = typeof parsed.rss === 'object' ? JSON.stringify(parsed.rss) : parsed.rss;
                if (parsed.weather) weatherLink = parsed.weather;
                if (parsed.clock) clockLink = parsed.clock;
            } catch (e) {
                console.warn("Could not parse widget multi-link JSON:", e);
            }
        }

        if (activeTypes.includes('qrcode') && widgets.qrcode) {
            const link = qrcodeLink || SERVER_URL;
            if (widgets.qrcodeImg) {
                widgets.qrcodeImg.src = state.qrcodeLocalPath || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}`;
            }
            widgets.qrcode.className = 'widget-item ' + placement;
            widgets.qrcode.classList.remove('hidden');
        }

        if (activeTypes.includes('weather') && widgets.weather) {
            widgets.weather.className = 'widget-item card hud ' + placement;
            const locEl = widgets.weather.querySelector('.location-name');
            if (locEl) locEl.innerText = weatherLink || 'Bengaluru';
            widgets.weather.classList.remove('hidden');
        }

        if (activeTypes.includes('clock') && widgets.clock) {
            widgets.clock.className = 'widget-item card hud ' + placement;
            if (widgets.clockTitle) widgets.clockTitle.innerText = clockLink || 'Lobby Clock';
            widgets.clock.classList.remove('hidden');
        }

        if (activeTypes.includes('rss') && widgets.rss) {
            let tickerText = rssLink || 'SignageOS Player online and running.';
            let labelText = '';
            let bgColor = '#ffffff';
            let textColor = '#1e293b';

            try {
                const config = JSON.parse(rssLink);
                if (config && typeof config === 'object') {
                    if (config.label) labelText = config.label;
                    if (Array.isArray(config.items)) {
                        tickerText = config.items.filter(item => item && item.trim() !== '').join('         |         ');
                    }
                    if (config.bgColor) bgColor = config.bgColor;
                    if (config.textColor) textColor = config.textColor;
                }
            } catch (e) {
                if (typeof rssLink === 'string') {
                    tickerText = rssLink.split('|').map(s => s.trim()).filter(Boolean).join('         |         ');
                }
            }

            const rssLabelEl = widgets.rss.querySelector('.rss-label');
            if (rssLabelEl) {
                if (labelText && labelText.trim() !== '') {
                    rssLabelEl.innerText = labelText;
                    rssLabelEl.style.display = 'block';
                } else {
                    rssLabelEl.style.display = 'none';
                }
            }
            if (widgets.rssText) widgets.rssText.innerText = tickerText + '         |         ';
            if (widgets.rssTextDup) {
                widgets.rssTextDup.innerText = tickerText + '         |         ';
                widgets.rssTextDup.style.color = textColor;
            }
            widgets.rss.style.backgroundColor = bgColor;
            if (widgets.rssText) widgets.rssText.style.color = textColor;
            widgets.rss.className = 'rss-ticker-container';

            if (widgets.rssText) {
                widgets.rssText.style.animation = 'none';
                if (widgets.rssTextDup) widgets.rssTextDup.style.animation = 'none';
                void widgets.rssText.offsetHeight;
                widgets.rssText.style.animation = '';
                if (widgets.rssTextDup) widgets.rssTextDup.style.animation = '';
            }
        }
    }

    function startClockWidget(widgets) {
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(() => {
            const now = new Date();
            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
            if (widgets.clockTime) widgets.clockTime.innerText = timeStr;
        }, 1000);
    }

    return {
        renderWidgets,
        startClockWidget
    };
})();
