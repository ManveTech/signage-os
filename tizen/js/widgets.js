/**
 * SignageOS Player - Overlay Widgets Module (Clock, Weather, RSS, QR Code)
 */

window.SignageWidgets = (function () {
    let clockInterval = null;

    function renderWidgets(state, widgets, SERVER_URL) {
        if (!widgets) return;

        // Hide all widget items initially
        if (widgets.qrcode) widgets.qrcode.className = 'widget-item hidden';
        if (widgets.weather) widgets.weather.className = 'widget-item card hud hidden';
        if (widgets.clock) widgets.clock.className = 'widget-item card hud hidden';
        if (widgets.rss) widgets.rss.className = 'rss-ticker-container hidden';

        const w = state ? state.widget : null;
        if (!w || !w.type || typeof w.type !== 'string' || w.type.trim() === '') {
            return;
        }

        console.log("Rendering widget overlay:", w.type, w.placement);
        const activeTypes = w.type.split(',').map(s => s.trim().toLowerCase());
        const placement = w.placement || 'top-right';

        let qrcodeLink = '';
        let rssLink = '';
        let weatherLink = '';
        let clockLink = '';
        let isMultiJson = false;

        if (w.link && typeof w.link === 'string' && w.link.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(w.link);
                if (parsed && typeof parsed === 'object') {
                    isMultiJson = true;
                    qrcodeLink = parsed.qrcode || parsed.QRCODE || parsed.qr || '';
                    weatherLink = parsed.weather || parsed.WEATHER || '';
                    clockLink = parsed.clock || parsed.CLOCK || '';
                    const r = parsed.rss !== undefined ? parsed.rss : parsed.RSS;
                    if (r !== undefined) {
                        rssLink = typeof r === 'object' ? JSON.stringify(r) : r;
                    }
                }
            } catch (e) {
                console.warn("Could not parse widget multi-link JSON:", e);
            }
        }

        if (!isMultiJson) {
            qrcodeLink = w.link || '';
            weatherLink = w.link || '';
            clockLink = w.link || '';
            rssLink = w.link || '';
        }

        if (activeTypes.includes('qrcode') && widgets.qrcode) {
            const link = (typeof qrcodeLink === 'string' && qrcodeLink.trim() && !qrcodeLink.trim().startsWith('{')) ? qrcodeLink : SERVER_URL;
            if (widgets.qrcodeImg) {
                widgets.qrcodeImg.src = state.qrcodeLocalPath || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}`;
            }
            widgets.qrcode.className = 'widget-item ' + placement;
            widgets.qrcode.classList.remove('hidden');
        }

        if (activeTypes.includes('weather') && widgets.weather) {
            widgets.weather.className = 'widget-item card hud ' + placement;
            const locEl = widgets.weather.querySelector('.location-name');
            if (locEl) {
                locEl.innerText = (typeof weatherLink === 'string' && weatherLink.trim() && !weatherLink.trim().startsWith('{')) ? weatherLink : 'Bengaluru';
            }
            widgets.weather.classList.remove('hidden');
        }

        if (activeTypes.includes('clock') && widgets.clock) {
            widgets.clock.className = 'widget-item card hud ' + placement;
            if (widgets.clockTitle) {
                const titleStr = (typeof clockLink === 'string' && clockLink.trim() && !clockLink.trim().startsWith('{')) ? clockLink : 'Lobby Clock';
                widgets.clockTitle.innerText = titleStr;
            }
            widgets.clock.classList.remove('hidden');
        }

        if (activeTypes.includes('rss') && widgets.rss) {
            let tickerText = 'SignageOS Player online and running.';
            let labelText = '';
            let bgColor = '#ffffff';
            let textColor = '#1e293b';

            let rawRssStr = rssLink;
            if (typeof rssLink === 'object') {
                rawRssStr = JSON.stringify(rssLink);
            }

            if (rawRssStr && typeof rawRssStr === 'string' && rawRssStr.trim() !== '') {
                try {
                    const config = JSON.parse(rawRssStr);
                    if (config && typeof config === 'object') {
                        if (config.label) labelText = config.label;
                        if (Array.isArray(config.items)) {
                            const validItems = config.items.filter(item => item && item.trim() !== '');
                            if (validItems.length > 0) {
                                tickerText = validItems.join('         |         ');
                            }
                        }
                        if (config.bgColor) bgColor = config.bgColor;
                        if (config.textColor) textColor = config.textColor;
                    }
                } catch (e) {
                    const parts = rawRssStr.split('|').map(s => s.trim()).filter(Boolean);
                    if (parts.length > 0) {
                        tickerText = parts.join('         |         ');
                    }
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
            widgets.rss.classList.remove('hidden');
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
