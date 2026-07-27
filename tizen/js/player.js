/**
 * SignageOS Player - Media Engine & Playlist Rotation Module
 */

window.SignagePlayer = (function () {
    const { KEYS, SERVER_URL, getPocketBaseUrl } = window.SignageConfig;
    const { getFileURI } = window.SignageStorage;
    const { clearScreenCommandOnServer, fetchWithTimeout, reportError } = window.SignageApi;

    let rotationTimeout = null;
    let rotationToken = 0;
    let activeImagePlayerNum = 1;

    async function syncLocalFiles(assets, state, views) {
        const overlay = document.getElementById('download-progress-overlay');
        const progressBar = document.getElementById('download-progress-bar');
        const statusDetail = document.getElementById('download-status-detail');

        if (overlay) overlay.classList.remove('hidden');

        function updateProgress(completed, total, currentName, downloadedBytes = 0, fileTotalBytes = 0) {
            const currentMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
            const totalMB = fileTotalBytes > 0 ? (fileTotalBytes / (1024 * 1024)).toFixed(1) : null;

            let detailStr = `Downloading asset ${completed} of ${total}`;
            if (currentName) detailStr += `: ${currentName}`;
            if (totalMB && parseFloat(totalMB) > 0) {
                detailStr += ` — ${currentMB} MB / ${totalMB} MB`;
            } else if (downloadedBytes > 0) {
                detailStr += ` — ${currentMB} MB`;
            }

            if (views.splashStatus) {
                views.splashStatus.innerText = `Downloading offline assets... ${completed}/${total}`;
            }
            if (statusDetail) {
                statusDetail.innerText = detailStr;
            }
            if (progressBar) {
                let filePct = (fileTotalBytes > 0) ? (downloadedBytes / fileTotalBytes) : 0;
                const baseIdx = Math.max(0, completed - 1);
                const overallPct = total > 0 ? Math.round(((baseIdx + filePct) / total) * 100) : 0;
                progressBar.style.width = `${Math.min(100, Math.max(0, overallPct))}%`;
            }
        }

        if (!window.tizen || !window.tizen.filesystem) {
            console.log("Not running on Tizen filesystem. Pre-buffering assets for browser playback...");
            updateProgress(0, assets.length, '');
            let completedCount = 0;
            await Promise.all(assets.map(async (asset) => {
                if (asset.url) {
                    try {
                        if (asset.mediaType === 'image') {
                            await new Promise((resolve) => {
                                const img = new Image();
                                img.onload = resolve;
                                img.onerror = resolve;
                                img.src = asset.url;
                                if (typeof img.decode === 'function') {
                                    img.decode().then(resolve).catch(resolve);
                                }
                            });
                        } else if (asset.mediaType === 'video') {
                            await new Promise((resolve) => {
                                const vid = document.createElement('video');
                                vid.oncanplay = resolve;
                                vid.onerror = resolve;
                                vid.src = asset.url;
                                setTimeout(resolve, 300);
                            });
                        }
                    } catch (_) {}
                    completedCount++;
                    updateProgress(completedCount, assets.length, asset.filename || asset.id);
                }
            }));
            if (overlay) overlay.classList.add('hidden');
            return assets;
        }

        try {
            const dir = await new Promise((resolve, reject) => {
                window.tizen.filesystem.resolve("wgt-private", resolve, reject, "rw");
            });

            console.log("Local wgt-private storage resolved. Syncing assets...");
            updateProgress(0, assets.length, '');

            for (let i = 0; i < assets.length; i++) {
                const asset = assets[i];
                if (!asset.url) continue;

                let ext = 'png';
                if (asset.mediaType === 'video') ext = 'mp4';
                else if (asset.url.includes('.gif')) ext = 'gif';
                else if (asset.url.includes('.jpg') || asset.url.includes('.jpeg')) ext = 'jpg';
                else if (asset.url.includes('.webp')) ext = 'webp';

                const filename = `asset_${asset.id}.${ext}`;

                try {
                    const file = dir.resolve(filename);
                    const localUri = getFileURI(file);
                    console.log(`Asset ${filename} already exists locally: ${localUri}`);
                    asset.url = localUri;
                    updateProgress(i + 1, assets.length, asset.filename || filename);
                } catch (e) {
                    console.log(`Downloading asset: ${asset.url} as ${filename}`);
                    
                    try {
                        let response;
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 45000);
                            response = await fetch(asset.url, { signal: controller.signal });
                            clearTimeout(timeoutId);
                            if (!response.ok) throw new Error("Direct fetch failed");
                        } catch (directErr) {
                            console.log(`Direct download failed. Trying proxy: ${asset.url}`);
                            const proxyUrl = `${SERVER_URL}/api/v1/public/proxy-media?url=${encodeURIComponent(asset.url)}`;
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 45000);
                            response = await fetch(proxyUrl, { signal: controller.signal });
                            clearTimeout(timeoutId);
                            if (!response.ok) throw new Error("Proxy download failed");
                        }

                        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
                        let blob;

                        if (response.body && typeof response.body.getReader === 'function') {
                            const reader = response.body.getReader();
                            const chunks = [];
                            let receivedBytes = 0;

                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                chunks.push(value);
                                receivedBytes += value.length;
                                updateProgress(i + 1, assets.length, asset.filename || filename, receivedBytes, contentLength);
                            }
                            blob = new Blob(chunks);
                        } else {
                            blob = await response.blob();
                            updateProgress(i + 1, assets.length, asset.filename || filename, blob.size, blob.size);
                        }

                        const base64Data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });

                        const file = dir.createFile(filename);
                        await new Promise((resolve, reject) => {
                            file.openStream("w", (stream) => {
                                try {
                                    if (typeof stream.writeBase64NonBlocking === 'function') {
                                        stream.writeBase64NonBlocking(base64Data, () => {
                                            stream.close();
                                            resolve();
                                        }, (writeErr) => {
                                            stream.close();
                                            reject(writeErr);
                                        });
                                    } else if (typeof stream.writeBase64 === 'function') {
                                        stream.writeBase64(base64Data);
                                        stream.close();
                                        resolve();
                                    } else if (typeof stream.writeDataNonBlocking === 'function') {
                                        const binaryString = window.atob(base64Data);
                                        const len = binaryString.length;
                                        const bytes = new Uint8Array(len);
                                        for (let j = 0; j < len; j++) {
                                            bytes[j] = binaryString.charCodeAt(j);
                                        }
                                        stream.writeDataNonBlocking(bytes, () => {
                                            stream.close();
                                            resolve();
                                        }, (writeErr) => {
                                            stream.close();
                                            reject(writeErr);
                                        });
                                    } else if (typeof stream.writeData === 'function') {
                                        const binaryString = window.atob(base64Data);
                                        const len = binaryString.length;
                                        const bytes = new Uint8Array(len);
                                        for (let j = 0; j < len; j++) {
                                            bytes[j] = binaryString.charCodeAt(j);
                                        }
                                        stream.writeData(bytes);
                                        stream.close();
                                        resolve();
                                    } else {
                                        stream.write(base64Data);
                                        stream.close();
                                        resolve();
                                    }
                                } catch (writeErr) {
                                    stream.close();
                                    reject(writeErr);
                                }
                            }, reject);
                        });

                        console.log(`Successfully cached asset ${filename} locally.`);
                        asset.url = getFileURI(file);
                    } catch (dlErr) {
                        console.error(`Failed to download and write asset ${filename}:`, dlErr);
                    }
                }
                updateProgress(i + 1, assets.length, asset.filename || filename);
            }

            if (!state.imageElementsCache) {
                state.imageElementsCache = {};
            }

            console.log("Starting upfront asset pre-decoding...");
            const imageAssets = assets.filter(a => a.mediaType === 'image' && a.url);
            if (imageAssets.length > 0) {
                if (views.splashStatus) {
                    views.splashStatus.innerText = "Optimizing display cache for smooth transitions...";
                }
                if (progressBar) progressBar.style.width = '0%';

                for (let k = 0; k < imageAssets.length; k++) {
                    const asset = imageAssets[k];
                    if (views.splashStatus) {
                        views.splashStatus.innerText = `Optimizing graphics cache... ${k + 1}/${imageAssets.length}`;
                    }
                    if (progressBar) {
                        const percent = ((k + 1) / imageAssets.length) * 100;
                        progressBar.style.width = `${percent}%`;
                    }

                    if (state.imageElementsCache[asset.id] && state.imageElementsCache[asset.id].src === asset.url) {
                        continue;
                    }

                    try {
                        await new Promise((resolve) => {
                            const img = new Image();
                            img.className = 'media-element';
                            img.style.display = 'block';
                            img.style.opacity = '0.001';
                            img.style.zIndex = '1';

                            img.onload = () => {
                                const container = document.getElementById('media-container');
                                if (container && img.parentNode !== container) {
                                    container.appendChild(img);
                                }

                                if (typeof img.decode === 'function') {
                                    img.decode().then(() => {
                                        state.imageElementsCache[asset.id] = img;
                                        resolve();
                                    }).catch(() => {
                                        state.imageElementsCache[asset.id] = img;
                                        resolve();
                                    });
                                } else {
                                    state.imageElementsCache[asset.id] = img;
                                    resolve();
                                }
                            };
                            img.onerror = () => resolve();
                            img.src = asset.url;
                        });
                    } catch (decodeErr) {
                        console.warn(`Upfront pre-decoding failed for ${asset.filename}:`, decodeErr);
                    }
                }
            }

            const activeAssetIds = assets.map(a => a.id);
            Object.keys(state.imageElementsCache).forEach(cachedId => {
                if (!activeAssetIds.includes(cachedId)) {
                    const img = state.imageElementsCache[cachedId];
                    if (img && img.parentNode) {
                        img.parentNode.removeChild(img);
                    }
                    delete state.imageElementsCache[cachedId];
                }
            });

        } catch (err) {
            console.error("Local filesystem synchronization failed:", err);
        }

        if (overlay) overlay.classList.add('hidden');
        return assets;
    }

    function startPlaylistRotation(state, views, updateUICallback) {
        if (rotationTimeout) clearTimeout(rotationTimeout);
        if (!state.playlist || state.playlist.length === 0) return;

        const currentToken = ++rotationToken;

        const asset = state.playlist[state.currentAssetIndex];
        if (!asset) {
            console.warn(`Asset at index ${state.currentAssetIndex} is undefined. Resetting to index 0.`);
            state.currentAssetIndex = 0;
            if (state.playlist && state.playlist[0]) {
                startPlaylistRotation(state, views, updateUICallback);
            }
            return;
        }

        console.log(`Rotating to asset index ${state.currentAssetIndex}: ${asset.filename} (${asset.mediaType})`);

        if (state.isOutOfRange) {
            views.imagePlayer1.style.display = 'none';
            views.imagePlayer2.style.display = 'none';
            views.videoPlayer.style.display = 'none';
            views.videoPlayer.pause();
            if (views.outOfRange) {
                views.outOfRange.style.display = 'flex';
            }
            const duration = (asset.duration || 10) * 1000;
            rotationTimeout = setTimeout(() => {
                if (currentToken === rotationToken) {
                    advancePlaylist(state, views, updateUICallback);
                }
            }, duration);
            return;
        }

        if (views.outOfRange) {
            views.outOfRange.style.display = 'none';
        }

        const transitionName = state.playlistTransition || 'fade';
        const animClass = 'animate-' + (
            transitionName === 'slide' ? 'slideIn' :
            transitionName === 'zoom' ? 'zoomIn' :
            transitionName === 'slide-up' ? 'slideUp' :
            transitionName === 'slide-down' ? 'slideDown' :
            transitionName === 'blur' ? 'blurIn' :
            transitionName === 'bounce' ? 'bounceIn' : 'fadeIn'
        );

        const activePlayer = activeImagePlayerNum === 1 ? views.imagePlayer1 : views.imagePlayer2;
        const inactivePlayer = activeImagePlayerNum === 1 ? views.imagePlayer2 : views.imagePlayer1;

        if (asset.mediaType === 'video') {
            views.videoPlayer.style.objectFit = asset.objectFit || 'cover';
            activePlayer.style.objectFit = asset.objectFit || 'cover';

            const scale = asset.scalePercent ? `scale(${asset.scalePercent / 100})` : 'scale(1)';
            views.videoPlayer.style.transform = scale;
            activePlayer.style.transform = scale;

            if (asset.thumbnail) {
                activePlayer.className = 'media-element';
                activePlayer.src = asset.thumbnail;
                activePlayer.style.display = 'block';
                activePlayer.style.opacity = '1';
            }

            const targetVol = (state.volume !== undefined && state.volume !== null ? state.volume : 80) / 100;
            views.videoPlayer.playsInline = true;
            views.videoPlayer.setAttribute('playsinline', 'true');
            views.videoPlayer.loop = false;
            views.videoPlayer.removeAttribute('loop');

            if (views.videoPlayer.src !== asset.url) {
                views.videoPlayer.src = asset.url;
            }
            try { views.videoPlayer.currentTime = 0; } catch (_) {}
            views.videoPlayer.volume = targetVol > 0 ? targetVol : 0.8;
            views.videoPlayer.muted = false;
            views.videoPlayer.removeAttribute('muted');
            views.videoPlayer.style.display = 'block';
            views.videoPlayer.style.zIndex = '3';

            let videoShown = false;
            const showVideo = () => {
                if (currentToken !== rotationToken || videoShown) return;
                videoShown = true;
                views.videoPlayer.style.opacity = '1';
                if (transitionName !== 'none') {
                    views.videoPlayer.className = 'media-element ' + animClass;
                } else {
                    views.videoPlayer.className = 'media-element';
                }

                setTimeout(() => {
                    if (currentToken === rotationToken) {
                        activePlayer.style.opacity = '0';
                        inactivePlayer.style.opacity = '0';
                        const container = document.getElementById('media-container');
                        if (container) {
                            const children = container.querySelectorAll('.media-element');
                            children.forEach(child => {
                                if (child !== views.videoPlayer) {
                                    child.style.opacity = '0.001';
                                    child.style.zIndex = '1';
                                }
                            });
                        }
                    }
                }, 400);
            };

            const cleanupVideoListeners = () => {
                views.videoPlayer.removeEventListener('playing', showVideo);
                views.videoPlayer.removeEventListener('canplay', showVideo);
                views.videoPlayer.removeEventListener('ended', handleEnded);
                views.videoPlayer.removeEventListener('error', handleError);
                views.videoPlayer.removeEventListener('loadedmetadata', setupMetadataSafetyTimer);
            };

            const handleEnded = () => {
                if (currentToken !== rotationToken) return;
                console.log(`Video playback completed naturally: ${asset.filename}`);
                cleanupVideoListeners();
                advancePlaylist(state, views, updateUICallback);
            };

            const handleError = (err) => {
                console.warn("Video playback error for asset:", asset.filename, err);
                if (currentToken !== rotationToken) return;
                cleanupVideoListeners();
                advancePlaylist(state, views, updateUICallback);
            };

            const setupMetadataSafetyTimer = () => {
                const dur = views.videoPlayer.duration;
                if (dur && !isNaN(dur) && dur > 0) {
                    const timeoutMs = (dur + 6) * 1000;
                    if (rotationTimeout) clearTimeout(rotationTimeout);
                    rotationTimeout = setTimeout(() => {
                        if (currentToken === rotationToken) {
                            console.warn(`Safety backup timer fired for video ${asset.filename}`);
                            cleanupVideoListeners();
                            try { views.videoPlayer.pause(); } catch (_) {}
                            advancePlaylist(state, views, updateUICallback);
                        }
                    }, timeoutMs);
                }
            };

            const enableAudio = () => {
                try {
                    if (views.videoPlayer) {
                        views.videoPlayer.muted = false;
                        views.videoPlayer.removeAttribute('muted');
                        views.videoPlayer.volume = targetVol > 0 ? targetVol : 0.8;
                        console.log("Video sound enabled!");
                    }
                } catch (_) {}
            };

            const setupAudioUnmuteListeners = () => {
                const handler = () => {
                    enableAudio();
                    window.removeEventListener('click', handler);
                    window.removeEventListener('keydown', handler);
                    window.removeEventListener('touchstart', handler);
                };
                window.addEventListener('click', handler, { once: true });
                window.addEventListener('keydown', handler, { once: true });
                window.addEventListener('touchstart', handler, { once: true });
            };

            views.videoPlayer.addEventListener('playing', showVideo);
            views.videoPlayer.addEventListener('canplay', showVideo);
            views.videoPlayer.addEventListener('ended', handleEnded);
            views.videoPlayer.addEventListener('error', handleError);
            views.videoPlayer.addEventListener('loadedmetadata', setupMetadataSafetyTimer);

            const initialSafetySec = Math.max(parseInt(asset.duration, 10) || 30, 30);
            if (rotationTimeout) clearTimeout(rotationTimeout);
            rotationTimeout = setTimeout(() => {
                if (currentToken === rotationToken) {
                    console.warn(`Initial safety timer fired for video ${asset.filename}`);
                    cleanupVideoListeners();
                    try { views.videoPlayer.pause(); } catch (_) {}
                    advancePlaylist(state, views, updateUICallback);
                }
            }, initialSafetySec * 1000 + 10000);

            views.videoPlayer.play().then(() => {
                showVideo();
                setupMetadataSafetyTimer();
            }).catch(e => {
                console.warn("Unmuted autoplay restricted. Retrying muted...", e);
                views.videoPlayer.muted = true;
                setupAudioUnmuteListeners();
                views.videoPlayer.play().then(() => {
                    showVideo();
                    setupMetadataSafetyTimer();
                }).catch(err => {
                    console.error("Muted video playback fallback failed:", err);
                    showVideo();
                });
            });
        } else {
            views.videoPlayer.style.opacity = '0.001';
            setTimeout(() => {
                if (currentToken === rotationToken) {
                    views.videoPlayer.style.display = 'none';
                }
            }, 600);

            if (!state.imageElementsCache[asset.id]) {
                const img = new Image();
                img.className = 'media-element';
                img.style.display = 'block';
                img.style.opacity = '0.001';
                img.style.zIndex = '1';
                img.src = asset.url;
                state.imageElementsCache[asset.id] = img;
            }

            const imgElement = state.imageElementsCache[asset.id];
            imgElement.style.objectFit = asset.objectFit || 'cover';
            const scale = asset.scalePercent ? `scale(${asset.scalePercent / 100})` : 'scale(1)';
            imgElement.style.transform = scale;

            const container = document.getElementById('media-container');
            if (imgElement.parentNode !== container) {
                container.appendChild(imgElement);
            }

            const duration = Math.max(parseInt(asset.duration, 10) || 10, 3) * 1000;

            const startTransition = () => {
                if (currentToken !== rotationToken) return;

                imgElement.style.display = 'block';
                imgElement.style.zIndex = '2';

                requestAnimationFrame(() => {
                    if (currentToken === rotationToken) {
                        imgElement.style.opacity = '1';
                        
                        if (transitionName !== 'none') {
                            imgElement.className = 'media-element ' + animClass;
                        } else {
                            imgElement.className = 'media-element';
                        }
                    }
                });

                setTimeout(() => {
                    if (currentToken === rotationToken) {
                        const children = container.querySelectorAll('.media-element');
                        children.forEach(child => {
                            if (child !== imgElement && child.id !== 'video-player') {
                                child.style.opacity = '0.001';
                                child.style.zIndex = '1';
                            }
                        });
                    }
                }, 500);

                if (rotationTimeout) clearTimeout(rotationTimeout);
                rotationTimeout = setTimeout(() => {
                    if (currentToken === rotationToken) {
                        advancePlaylist(state, views, updateUICallback);
                    }
                }, duration);

                // Pre-decode next slide in background for instant transition
                if (state.playlist && state.playlist.length > 1) {
                    const nextIdx = (state.currentAssetIndex + 1) % state.playlist.length;
                    const nextAsset = state.playlist[nextIdx];
                    if (nextAsset && nextAsset.mediaType === 'image' && nextAsset.url) {
                        if (!state.imageElementsCache[nextAsset.id]) {
                            const nxtImg = new Image();
                            nxtImg.className = 'media-element';
                            nxtImg.style.display = 'block';
                            nxtImg.style.opacity = '0.001';
                            nxtImg.style.zIndex = '1';
                            nxtImg.src = nextAsset.url;
                            state.imageElementsCache[nextAsset.id] = nxtImg;
                            if (container && nxtImg.parentNode !== container) {
                                container.appendChild(nxtImg);
                            }
                            if (typeof nxtImg.decode === 'function') {
                                nxtImg.decode().catch(() => {});
                            }
                        }
                    }
                }
            };

            if (imgElement.complete && imgElement.naturalWidth > 0) {
                startTransition();
            } else {
                const handleLoad = () => {
                    imgElement.removeEventListener('load', handleLoad);
                    imgElement.removeEventListener('error', handleError);
                    startTransition();
                };
                const handleError = (err) => {
                    console.error(`Dynamic image element load failed: ${asset.url}`, err);
                    imgElement.removeEventListener('load', handleLoad);
                    imgElement.removeEventListener('error', handleError);
                    advancePlaylist(state, views, updateUICallback);
                };
                imgElement.addEventListener('load', handleLoad);
                imgElement.addEventListener('error', handleError);
                if (!imgElement.src) {
                    imgElement.src = asset.url;
                }
            }
        }
    }

    function advancePlaylist(state, views, updateUICallback) {
        if (rotationTimeout) clearTimeout(rotationTimeout);
        if (state.playlist.length > 0) {
            if (state.currentAssetIndex === state.playlist.length - 1 && !state.playlistLoop) {
                console.log("End of playlist reached and loop is disabled. Stopping rotation.");
                return;
            }
            state.currentAssetIndex = (state.currentAssetIndex + 1) % state.playlist.length;
            startPlaylistRotation(state, views, updateUICallback);
        }
    }

    async function fetchPlaylist(playlistId, state, views, updateUICallback) {
        try {
            const POCKETBASE_URL = getPocketBaseUrl();
            const url = `${POCKETBASE_URL}/api/collections/playlists/records/${playlistId}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Playlist retrieval failed');
            const data = await res.json();

            const oldWidgetStr = JSON.stringify(state.widget || {});
            state.widget = {
                type: data.widgetType || null,
                placement: data.widgetPlacement || 'top-right',
                link: data.widgetLink || ''
            };
            localStorage.setItem(KEYS.WIDGET, JSON.stringify(state.widget));
            const widgetChanged = oldWidgetStr !== JSON.stringify(state.widget || {});

            const lastUpdated = data.updated;
            const cachedPlaylistUpdated = localStorage.getItem('signage_tizen_playlist_updated') || '';
            const isPlaylistEmpty = !state.playlist || state.playlist.length === 0;

            if (lastUpdated === cachedPlaylistUpdated && !isPlaylistEmpty) {
                if (widgetChanged) {
                    console.log("Widget configuration updated on playlist. Re-rendering overlay in-place.");
                    if (window.SignageWidgetsRef && typeof window.SignageWidgetsRef.renderWidgets === 'function') {
                        window.SignageWidgetsRef.renderWidgets(state, views.widgets || window.widgetsRef, SERVER_URL);
                    }
                }
                return;
            }

            let fetchedAssets = [];
            let slides = data.slides || [];
            if (typeof slides === 'string') {
                try { slides = JSON.parse(slides); } catch (e) { slides = []; }
            }

            if (Array.isArray(slides) && slides.length > 0) {
                const results = await Promise.all(slides.map(async (slide) => {
                    try {
                        const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${slide.mediaId}`);
                        if (mediaRes.ok) {
                            const media = await mediaRes.json();
                            const rawUrl = media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail;
                            return {
                                id: media.id,
                                url: rawUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                                mediaType: media.type.toLowerCase(),
                                filename: media.title,
                                duration: parseInt(slide.duration || media.duration || 10, 10),
                                thumbnail: media.thumbnail || rawUrl,
                                objectFit: slide.objectFit || 'cover',
                                scalePercent: slide.scalePercent || 100
                            };
                        }
                    } catch (e) {}
                    return null;
                }));
                fetchedAssets = results.filter(Boolean);
            } else if (data.assetsJson && data.assetsJson.length > 0) {
                data.assetsJson.forEach((pbAsset) => {
                    fetchedAssets.push({
                        id: pbAsset.id,
                        url: pbAsset.url + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                        mediaType: pbAsset.mediaType.toLowerCase(),
                        filename: pbAsset.filename,
                        duration: pbAsset.duration || 10,
                        thumbnail: pbAsset.thumbnail || pbAsset.url,
                        objectFit: pbAsset.objectFit || 'cover',
                        scalePercent: pbAsset.scalePercent || 100
                    });
                });
            } else if (data.files && data.files.length > 0) {
                data.files.forEach((fileName, index) => {
                    const rawUrl = `${POCKETBASE_URL}/api/files/playlists/${playlistId}/${fileName}`;
                    fetchedAssets.push({
                        id: `${playlistId}_${index}`,
                        url: rawUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                        mediaType: "image",
                        filename: fileName,
                        duration: 10,
                        thumbnail: rawUrl,
                        objectFit: 'cover',
                        scalePercent: 100
                    });
                });
            } else if (data.mediaIds && data.mediaIds.length > 0) {
                const results = await Promise.all(data.mediaIds.map(async (mediaId) => {
                    try {
                        const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${mediaId}`);
                        if (mediaRes.ok) {
                            const media = await mediaRes.json();
                            const rawUrl = media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail;
                            return {
                                id: media.id,
                                url: rawUrl + (state.cacheBust ? `?cb=${state.cacheBust}` : ''),
                                mediaType: media.type.toLowerCase(),
                                filename: media.title,
                                duration: media.duration || 10,
                                thumbnail: media.thumbnail || rawUrl,
                                objectFit: 'cover',
                                scalePercent: 100
                            };
                        }
                    } catch (e) {}
                    return null;
                }));
                fetchedAssets = results.filter(Boolean);
            }

            if (data.shuffle && fetchedAssets.length > 0) {
                fetchedAssets = fetchedAssets.sort(() => Math.random() - 0.5);
            }

            state.playlistTransition = data.transition || 'fade';
            state.playlistLoop = data.loop !== false;
            state.orientation = data.orientation || 'horizontal';

            localStorage.setItem('signage_tizen_transition', state.playlistTransition);
            localStorage.setItem('signage_tizen_loop', state.playlistLoop);
            localStorage.setItem('signage_tizen_orientation', state.orientation);

            try {
                const localAssets = await syncLocalFiles(fetchedAssets.map(a => Object.assign({}, a)), state, views);
                
                const currentKeys = (state.playlist || []).map(a => a.id);
                const newKeys = localAssets.map(a => a.id);
                const isDifferent = JSON.stringify(newKeys) !== JSON.stringify(currentKeys);
                
                state.playlist = localAssets;
                localStorage.setItem(KEYS.PLAYLIST, JSON.stringify(state.playlist));
                if (lastUpdated) localStorage.setItem('signage_tizen_playlist_updated', lastUpdated);

                if (isDifferent || isPlaylistEmpty) {
                    state.currentAssetIndex = 0;
                    state.isRotating = false;
                    if (updateUICallback) updateUICallback();
                    startPlaylistRotation(state, views, updateUICallback);
                } else {
                    if (updateUICallback) updateUICallback();
                }
            } catch (syncErr) {
                console.error("Local file sync failed:", syncErr);
            }

            localStorage.setItem('signage_tizen_playlist_updated', lastUpdated);
        } catch (err) {
            console.error("Error syncing playlist assets:", err);
        }
    }

    return {
        syncLocalFiles,
        startPlaylistRotation,
        advancePlaylist,
        fetchPlaylist
    };
})();
