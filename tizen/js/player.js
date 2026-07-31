/**
 * SignageOS Player - Lightweight Offline-First Playback Engine
 *
 * Design goals for low-power Samsung Tizen panels (QBC class, ~2GB RAM):
 *   1. Download every asset once to persistent wgt-private storage, then play
 *      from disk so the screen keeps looping even with no network.
 *   2. Stream downloads straight to disk (no whole-file base64 in memory) so
 *      large videos/images never blow the tiny webview memory budget.
 *   3. Request display-sized images (1920 long edge) so the panel decodes a
 *      ~2MP JPEG instead of a multi-megapixel 4K source. This is what keeps
 *      each slide's decode near-instant and the duration accurate.
 *   4. Keep only the two on-screen <img> buffers decoded at any time.
 */

window.SignagePlayer = (function () {
    const { KEYS, SERVER_URL, getPocketBaseUrl } = window.SignageConfig;
    const { getFileURI } = window.SignageStorage;

    // Longest edge (px) we ever want the TV to download/decode for a still image.
    // A 1080p panel (landscape or rotated portrait) never needs more than this.
    const TARGET_EDGE = 1920;

    let rotationTimeout = null;
    let rotationToken = 0;
    let activeImageNum = 1;
    let isDownloading = false;

    function stopAndUnloadVideo(video) {
        if (!video) return;
        try {
            video.pause();
            video.removeAttribute('src');
            video.load();
        } catch (_) {}
        video.style.display = 'none';
        video.style.opacity = '0';
        video.classList.remove('active');
    }

    function prefetchNextSlide(state, views, currentToken) {
        setTimeout(() => {
            if (currentToken !== rotationToken || !state.playlist || state.playlist.length <= 1) return;
            const nextIndex = (state.currentAssetIndex + 1) % state.playlist.length;
            const nextAsset = state.playlist[nextIndex];
            if (!nextAsset || !nextAsset.url) return;

            // Only prefetch images into the hidden buffer. Never touch <video> off-screen on Tizen,
            // as modifying video.src while idle triggers hardware decoder context collisions & OOM crashes.
            if (nextAsset.mediaType === 'image') {
                const inactiveImg = activeImageNum === 1 ? views.imagePlayer2 : views.imagePlayer1;
                if (inactiveImg && inactiveImg.src !== nextAsset.url) {
                    inactiveImg.style.display = 'none';
                    inactiveImg.style.opacity = '0';
                    inactiveImg.src = nextAsset.url;
                    if (typeof inactiveImg.decode === 'function') {
                        inactiveImg.decode().catch(() => {});
                    }
                }
            }
        }, 100);
    }

    /**
     * Rewrite a raw media URL into a display-sized variant so the TV downloads
     * and decodes a small image. Videos and already-local resources are left
     * untouched.
     *   - PocketBase files (`/api/files/...`) -> on-the-fly `?thumb=` (zero cost
     *     server dependency, cached by PocketBase after first request).
     *   - R2 / external images -> routed through our resizing media proxy.
     */
    function optimizeImageUrl(rawUrl) {
        if (!rawUrl) return rawUrl;
        if (rawUrl.startsWith('file:') || rawUrl.startsWith('blob:')) return rawUrl;

        if (rawUrl.includes('/api/files/')) {
            const sep = rawUrl.includes('?') ? '&' : '?';
            // `f` = fit within the box preserving aspect ratio (no crop, no pad).
            return `${rawUrl}${sep}thumb=${TARGET_EDGE}x${TARGET_EDGE}f`;
        }
        return `${SERVER_URL}/api/v1/public/proxy-media?url=${encodeURIComponent(rawUrl)}&w=${TARGET_EDGE}`;
    }

    function optimizeAssetUrl(rawUrl, mediaType) {
        return mediaType === 'video' ? rawUrl : optimizeImageUrl(rawUrl);
    }

    // Stable, filesystem-safe cache key. Keyed by mediaId (not slide index) so
    // reordering a playlist or reusing the same media never re-downloads.
    function cacheKeyOf(asset) {
        const key = asset.mediaId || asset.id || asset.filename || 'asset';
        return String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function cacheFilenameOf(asset) {
        let ext = asset.mediaType === 'video' ? 'mp4' : 'jpg';
        const src = asset.url || '';
        if (asset.mediaType !== 'video') {
            if (src.includes('.png')) ext = 'png';
            else if (src.includes('.webp')) ext = 'webp';
            else if (src.includes('.gif')) ext = 'gif';
        }
        return `asset_${cacheKeyOf(asset)}.${ext}`;
    }

    function updateDownloadProgress(completed, total, currentName, downloadedBytes = 0, fileTotalBytes = 0) {
        const overlay = document.getElementById('download-progress-overlay');
        const progressBar = document.getElementById('download-progress-bar');
        const statusDetail = document.getElementById('download-status-detail');

        if (overlay) overlay.classList.remove('hidden');

        const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
        const totalMB = fileTotalBytes > 0 ? (fileTotalBytes / (1024 * 1024)).toFixed(1) : null;

        let detailStr = `Downloading asset ${completed} of ${total}`;
        if (currentName) detailStr += `: ${currentName}`;
        if (totalMB && parseFloat(totalMB) > 0) {
            detailStr += ` — ${downloadedMB} MB / ${totalMB} MB`;
        } else if (downloadedBytes > 0) {
            detailStr += ` — ${downloadedMB} MB`;
        }

        if (statusDetail) statusDetail.innerText = detailStr;

        if (progressBar) {
            let filePct = (fileTotalBytes > 0) ? (downloadedBytes / fileTotalBytes) : 0;
            const baseIdx = Math.max(0, completed - 1);
            const overallPct = total > 0 ? Math.round(((baseIdx + filePct) / total) * 100) : 0;
            progressBar.style.width = `${Math.min(100, Math.max(0, overallPct))}%`;
        }
    }

    function hideDownloadOverlay() {
        const overlay = document.getElementById('download-progress-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    async function fetchInBatches(items, batchSize, fetchFn) {
        const results = new Array(items.length);
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map((item, idx) => fetchFn(item, i + idx)));
            for (let j = 0; j < batchResults.length; j++) {
                results[i + j] = batchResults[j];
            }
        }
        return results;
    }

    // ---- Tizen filesystem helpers -----------------------------------------

    function resolveDir(path, mode) {
        return new Promise((resolve, reject) => {
            window.tizen.filesystem.resolve(path, resolve, reject, mode);
        });
    }

    // Stream an HTTP response body directly to a Tizen file, writing each chunk
    // as it arrives so the full asset is never held in memory at once.
    async function streamResponseToFile(response, file, onChunk) {
        const canStream = response.body && typeof response.body.getReader === 'function';

        return new Promise((resolve, reject) => {
            file.openStream('w', async (stream) => {
                try {
                    let received = 0;
                    if (canStream) {
                        const reader = response.body.getReader();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            // writeBytes needs a plain octet array; convert per
                            // small chunk to keep memory flat.
                            stream.writeBytes(Array.prototype.slice.call(value));
                            received += value.length;
                            if (onChunk) onChunk(received);
                        }
                    } else {
                        // Fallback for webviews without a streaming body reader.
                        const buf = new Uint8Array(await response.arrayBuffer());
                        stream.writeBytes(Array.prototype.slice.call(buf));
                        received = buf.length;
                        if (onChunk) onChunk(received);
                    }
                    stream.close();
                    resolve(received);
                } catch (e) {
                    try { stream.close(); } catch (_) {}
                    reject(e);
                }
            }, reject, 'UTF-8');
        });
    }

    // Remove cached files that are no longer referenced by the active playlist,
    // so storage doesn't fill up over time and start rejecting writes.
    async function cleanupOrphans(tizenDir, keepFilenames) {
        try {
            const files = await new Promise((resolve, reject) => {
                tizenDir.listFiles(resolve, reject);
            });
            for (const f of files) {
                if (f && f.isFile && f.name.indexOf('asset_') === 0 && !keepFilenames.has(f.name)) {
                    try {
                        await new Promise((resolve) => {
                            tizenDir.deleteFile(f.fullPath, resolve, resolve);
                        });
                        console.log(`[Player] Removed stale cached asset: ${f.name}`);
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Player] Orphan cleanup skipped:', e);
        }
    }

    async function fetchWithTimeout(url, timeoutMs) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Ensure every asset is available locally. On Tizen, downloads stream to
     * wgt-private and `asset.url` is rewritten to the persistent file:// URI so
     * playback (and offline reloads) read from disk. Assets that fail to cache
     * keep their remote URL so a later online sync can retry them.
     */
    async function syncLocalFiles(assets) {
        assets = assets || [];
        if (isDownloading) return assets;

        isDownloading = true;
        const totalAssets = assets.length;
        const isTizen = !!(window.tizen && window.tizen.filesystem);
        let tizenDir = null;

        if (isTizen) {
            try {
                tizenDir = await resolveDir('wgt-private', 'rw');
            } catch (e) {
                console.warn('[Player] Tizen storage resolve error:', e);
            }
        }

        const keepFilenames = new Set();
        const missingAssets = [];
        let cachedCount = 0;

        // Pass 1: resolve what is already on disk.
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            if (!asset.url) continue;

            if (tizenDir) {
                const filename = cacheFilenameOf(asset);
                keepFilenames.add(filename);
                try {
                    const file = tizenDir.resolve(filename);
                    if (file && file.fileSize > 0) {
                        asset.url = getFileURI(file);
                        cachedCount++;
                    } else {
                        missingAssets.push({ index: i, asset, filename });
                    }
                } catch (_) {
                    missingAssets.push({ index: i, asset, filename });
                }
            } else if (asset.url.startsWith('blob:') || asset.url.startsWith('file:')) {
                cachedCount++;
            } else {
                missingAssets.push({ index: i, asset, filename: cacheFilenameOf(asset) });
            }
        }

        // Pass 2: download whatever is missing (sequential = gentle on memory).
        if (missingAssets.length > 0) {
            console.log(`[Player] Total: ${totalAssets}, Cached: ${cachedCount}, Downloading: ${missingAssets.length}`);
            updateDownloadProgress(cachedCount, totalAssets, '');

            for (let k = 0; k < missingAssets.length; k++) {
                const { asset, filename } = missingAssets[k];
                const currentProgressIdx = cachedCount + k + 1;

                try {
                    let response;
                    try {
                        response = await fetchWithTimeout(asset.url, 60000);
                        if (!response.ok) throw new Error('Direct fetch failed');
                    } catch (directErr) {
                        console.log(`[Player] Direct download failed for ${asset.url}, using proxy...`);
                        const proxyUrl = `${SERVER_URL}/api/v1/public/proxy-media?url=${encodeURIComponent(asset.url)}`;
                        response = await fetchWithTimeout(proxyUrl, 60000);
                        if (!response.ok) throw new Error('Proxy download failed');
                    }

                    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
                    const displayName = asset.filename || filename;

                    if (tizenDir) {
                        const file = tizenDir.createFile(filename);
                        const written = await streamResponseToFile(response, file, (bytes) => {
                            updateDownloadProgress(currentProgressIdx, totalAssets, displayName, bytes, contentLength);
                        });

                        // Verify the write landed intact before trusting it for
                        // offline playback. A truncated file is deleted and the
                        // asset keeps its remote URL for a later retry.
                        let ok = written > 0;
                        try {
                            const check = tizenDir.resolve(filename);
                            const size = check ? check.fileSize : 0;
                            if (contentLength > 0 && size !== contentLength) ok = false;
                            if (!size) ok = false;
                            if (ok) {
                                asset.url = getFileURI(check);
                                console.log(`[Player] Cached ${displayName} (${size} bytes)`);
                            }
                        } catch (_) {
                            ok = false;
                        }

                        if (!ok) {
                            console.warn(`[Player] Verification failed for ${displayName}; will retry on next sync`);
                            try {
                                await new Promise((resolve) => tizenDir.deleteFile(file.fullPath, resolve, resolve));
                            } catch (_) {}
                            keepFilenames.delete(filename);
                        }
                    } else {
                        // Non-Tizen (browser/dev only): blob URL is fine for the
                        // session. Real panels always take the disk path above.
                        const blob = await response.blob();
                        asset.url = URL.createObjectURL(blob);
                        updateDownloadProgress(currentProgressIdx, totalAssets, displayName, blob.size, blob.size);
                    }
                } catch (dlErr) {
                    console.error(`[Player] Download failed for ${asset.filename}:`, dlErr);
                    keepFilenames.delete(filename);
                    // Drop any partial file so it isn't mistaken for a valid
                    // cache entry on the next sync.
                    if (tizenDir) {
                        try {
                            const partial = tizenDir.resolve(filename);
                            if (partial) {
                                await new Promise((resolve) => tizenDir.deleteFile(partial.fullPath, resolve, resolve));
                            }
                        } catch (_) {}
                    }
                }
            }
        }

        if (tizenDir) {
            await cleanupOrphans(tizenDir, keepFilenames);
        }

        hideDownloadOverlay();
        isDownloading = false;
        return assets;
    }

    /**
     * Exact-duration double-buffered rotation. Only the two on-screen <img>
     * elements are ever decoded; the next slide is prefetched into the hidden
     * buffer during the current slide.
     */
    function startPlaylistRotation(state, views, updateUICallback) {
        if (rotationTimeout) clearTimeout(rotationTimeout);
        if (!state.playlist || state.playlist.length === 0) return;

        const currentToken = ++rotationToken;
        const asset = state.playlist[state.currentAssetIndex];

        if (!asset) {
            state.currentAssetIndex = 0;
            if (state.playlist && state.playlist[0]) {
                startPlaylistRotation(state, views, updateUICallback);
            }
            return;
        }

        const duration = Math.max(parseInt(asset.duration, 10) || 10, 2) * 1000;
        console.log(`[Player] Slide ${state.currentAssetIndex + 1}/${state.playlist.length}: ${asset.filename} (${asset.mediaType}, ${asset.duration}s)`);

        if (window.SignageWidgets) {
            window.SignageWidgets.syncWidgets(state, asset);
        }

        if (asset.mediaType === 'video') {
            const video = views.videoPlayer;
            if (!video) {
                advancePlaylist(state, views, updateUICallback);
                return;
            }

            // Teardown any existing decoder pipeline before binding new video src
            stopAndUnloadVideo(video);

            video.muted = false;
            video.volume = 1.0;
            video.style.objectFit = asset.objectFit || 'cover';
            video.style.display = 'block';
            video.style.zIndex = '4';

            video.src = asset.url;

            let videoDone = false;
            let videoSwapped = false;
            let safetyWatchdog = null;

            const cleanUpVideo = () => {
                video.removeEventListener('ended', onVideoEnd);
                video.removeEventListener('error', onVideoError);
                video.removeEventListener('playing', onVideoFrameReady);
                video.removeEventListener('canplay', onVideoFrameReady);
                video.removeEventListener('loadedmetadata', onMetadata);
                if (safetyWatchdog) { clearTimeout(safetyWatchdog); safetyWatchdog = null; }
            };

            const onVideoEnd = () => {
                if (currentToken !== rotationToken || videoDone) return;
                videoDone = true;
                cleanUpVideo();
                advancePlaylist(state, views, updateUICallback);
            };

            const onVideoError = (err) => {
                console.warn('[Player] Video playback error for:', asset.filename, err);
                if (currentToken !== rotationToken || videoDone) return;
                videoDone = true;
                cleanUpVideo();
                advancePlaylist(state, views, updateUICallback);
            };

            const onVideoFrameReady = () => {
                if (videoSwapped || currentToken !== rotationToken) return;
                videoSwapped = true;

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (currentToken !== rotationToken) return;

                        video.style.opacity = '1';
                        video.classList.add('active');

                        if (views.imagePlayer1) {
                            views.imagePlayer1.style.opacity = '0';
                            views.imagePlayer1.style.zIndex = '1';
                            views.imagePlayer1.style.display = 'none';
                            views.imagePlayer1.classList.remove('active');
                        }
                        if (views.imagePlayer2) {
                            views.imagePlayer2.style.opacity = '0';
                            views.imagePlayer2.style.zIndex = '1';
                            views.imagePlayer2.style.display = 'none';
                            views.imagePlayer2.classList.remove('active');
                        }

                        prefetchNextSlide(state, views, currentToken);
                    });
                });
            };

            const onMetadata = () => {
                if (currentToken !== rotationToken) return;
                if (video.duration && isFinite(video.duration) && video.duration > 0) {
                    const realDurationMs = Math.ceil(video.duration * 1000);
                    if (rotationTimeout) clearTimeout(rotationTimeout);
                    rotationTimeout = setTimeout(() => {
                        if (currentToken === rotationToken && !videoDone) {
                            console.log(`[Player] Video ended by real-duration timer: ${asset.filename}`);
                            onVideoEnd();
                        }
                    }, realDurationMs + 3000);
                }
            };

            video.addEventListener('ended', onVideoEnd);
            video.addEventListener('error', onVideoError);
            video.addEventListener('playing', onVideoFrameReady);
            video.addEventListener('canplay', onVideoFrameReady);
            video.addEventListener('loadedmetadata', onMetadata);

            const fallbackTimeout = Math.max(duration, 12000) + 5000;
            safetyWatchdog = setTimeout(() => {
                if (currentToken === rotationToken && !videoDone) {
                    console.warn('[Player] Video fallback watchdog fired for:', asset.filename);
                    onVideoEnd();
                }
            }, fallbackTimeout);

            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    onVideoFrameReady();
                }).catch((e) => {
                    console.warn('[Player] Unmuted play failed, retrying play for:', asset.filename, e);
                    video.muted = false;
                    video.volume = 1.0;
                    video.play().then(() => {
                        onVideoFrameReady();
                    }).catch(onVideoError);
                });
            }

        } else {
            // Image playback - double-buffered swap, duration timed from paint.
            activeImageNum = activeImageNum === 1 ? 2 : 1;
            const activeImg = activeImageNum === 1 ? views.imagePlayer1 : views.imagePlayer2;
            const inactiveImg = activeImageNum === 1 ? views.imagePlayer2 : views.imagePlayer1;

            if (!activeImg || !inactiveImg) {
                advancePlaylist(state, views, updateUICallback);
                return;
            }

            activeImg.style.objectFit = asset.objectFit || 'cover';
            const tSwapRequested = performance.now();

            let settled = false;
            let loadWatchdog = null;
            const clearWatchdog = () => {
                if (loadWatchdog) { clearTimeout(loadWatchdog); loadWatchdog = null; }
            };

            // If an image can't load (offline + not cached, or a hung request),
            // skip to the next slide instead of freezing the screen.
            loadWatchdog = setTimeout(() => {
                if (currentToken !== rotationToken || settled) return;
                settled = true;
                console.warn('[Player] Image load watchdog fired, skipping:', asset.filename);
                advancePlaylist(state, views, updateUICallback);
            }, Math.max(duration, 8000) + 4000);

            const onImgError = () => {
                if (currentToken !== rotationToken || settled) return;
                settled = true;
                clearWatchdog();
                console.warn('[Player] Failed to load image asset:', asset.filename);
                setTimeout(() => {
                    if (currentToken === rotationToken) advancePlaylist(state, views, updateUICallback);
                }, 800);
            };

            const performSwapAndStartTimer = () => {
                if (currentToken !== rotationToken || settled) return;
                settled = true;
                clearWatchdog();

                stopAndUnloadVideo(views.videoPlayer);

                // Active buffer to front (painted), inactive buffer behind.
                activeImg.style.display = 'block';
                activeImg.style.zIndex = '3';
                activeImg.style.opacity = '1';
                activeImg.classList.add('active');

                if (inactiveImg) {
                    inactiveImg.classList.remove('active');
                    inactiveImg.style.zIndex = '1';
                    inactiveImg.style.opacity = '0';
                }

                // Double rAF guarantees the pixels are on the panel before the
                // duration timer starts, so each slide is visible for its full
                // configured time.
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (currentToken !== rotationToken) return;

                        const tPainted = performance.now();
                        const paintLatency = Math.round(tPainted - tSwapRequested);

                        if (rotationTimeout) clearTimeout(rotationTimeout);
                        rotationTimeout = setTimeout(() => {
                            if (currentToken === rotationToken) {
                                const drift = Math.round(performance.now() - tPainted) - duration;
                                console.log(`[TIMING] Slide ${state.currentAssetIndex + 1}/${state.playlist.length}: ${asset.filename} | Expected ${duration}ms | Paint ${paintLatency}ms | Drift ${drift >= 0 ? '+' : ''}${drift}ms`);
                                advancePlaylist(state, views, updateUICallback);
                            }
                        }, duration);

                        prefetchNextSlide(state, views, currentToken);
                    });
                });
            };

            const decodeThenSwap = () => {
                if (typeof activeImg.decode === 'function') {
                    activeImg.decode().then(performSwapAndStartTimer).catch(performSwapAndStartTimer);
                } else {
                    performSwapAndStartTimer();
                }
            };

            if (activeImg.src !== asset.url) {
                activeImg.onload = decodeThenSwap;
                activeImg.onerror = onImgError;
                activeImg.src = asset.url;
            } else if (activeImg.complete && activeImg.naturalWidth > 0) {
                decodeThenSwap();
            } else {
                activeImg.onload = decodeThenSwap;
                activeImg.onerror = onImgError;
            }
        }
    }

    function advancePlaylist(state, views, updateUICallback) {
        if (rotationTimeout) clearTimeout(rotationTimeout);
        if (state.playlist && state.playlist.length > 0) {
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

            let fetchedAssets = [];
            let slides = data.slides || [];
            if (typeof slides === 'string') {
                try { slides = JSON.parse(slides); } catch (e) { slides = []; }
            }

            if (Array.isArray(slides) && slides.length > 0) {
                const results = await fetchInBatches(slides, 5, async (slide, slideIdx) => {
                    try {
                        const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${slide.mediaId}`);
                        if (mediaRes.ok) {
                            const media = await mediaRes.json();
                            const rawUrl = media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail;
                            const mediaType = (media.type || 'image').toLowerCase();
                            return {
                                id: `${media.id}_${slideIdx}`,
                                mediaId: media.id,
                                url: optimizeAssetUrl(rawUrl, mediaType),
                                mediaType: mediaType,
                                filename: media.title || media.file || 'Media Item',
                                duration: parseInt(slide.duration || media.duration || 10, 10),
                                objectFit: slide.objectFit || 'cover',
                                widgetType: slide.widgetType || data.widgetType || '',
                                widgetPlacement: slide.widgetPlacement || data.widgetPlacement || 'top-right',
                                widgetLink: slide.widgetLink || data.widgetLink || '',
                                tickerText: slide.tickerText || data.tickerText || '',
                                tickerLabel: slide.tickerLabel || data.tickerLabel || ''
                            };
                        }
                    } catch (e) {}
                    return null;
                });
                fetchedAssets = results.filter(Boolean);
            } else if (data.assetsJson && data.assetsJson.length > 0) {
                data.assetsJson.forEach((pbAsset, idx) => {
                    const mediaType = (pbAsset.mediaType || 'image').toLowerCase();
                    fetchedAssets.push({
                        id: pbAsset.id ? `${pbAsset.id}_${idx}` : `asset_${idx}`,
                        mediaId: pbAsset.id || null,
                        url: optimizeAssetUrl(pbAsset.url, mediaType),
                        mediaType: mediaType,
                        filename: pbAsset.filename || 'Asset',
                        duration: parseInt(pbAsset.duration || 10, 10),
                        objectFit: pbAsset.objectFit || 'cover',
                        widgetType: pbAsset.widgetType || data.widgetType || '',
                        widgetPlacement: pbAsset.widgetPlacement || data.widgetPlacement || 'top-right',
                        widgetLink: pbAsset.widgetLink || data.widgetLink || '',
                        tickerText: pbAsset.tickerText || data.tickerText || '',
                        tickerLabel: pbAsset.tickerLabel || data.tickerLabel || ''
                    });
                });
            } else if (data.files && data.files.length > 0) {
                data.files.forEach((fileName, index) => {
                    const rawUrl = `${POCKETBASE_URL}/api/files/playlists/${playlistId}/${fileName}`;
                    fetchedAssets.push({
                        id: `${playlistId}_${index}`,
                        mediaId: `${playlistId}_${fileName}`,
                        url: optimizeAssetUrl(rawUrl, 'image'),
                        mediaType: 'image',
                        filename: fileName,
                        duration: 10,
                        objectFit: 'cover',
                        widgetType: data.widgetType || '',
                        widgetPlacement: data.widgetPlacement || 'top-right',
                        widgetLink: data.widgetLink || '',
                        tickerText: data.tickerText || '',
                        tickerLabel: data.tickerLabel || ''
                    });
                });
            } else if (data.mediaIds && data.mediaIds.length > 0) {
                const results = await fetchInBatches(data.mediaIds, 5, async (mediaId, mediaIdx) => {
                    try {
                        const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${mediaId}`);
                        if (mediaRes.ok) {
                            const media = await mediaRes.json();
                            const rawUrl = media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail;
                            const mediaType = (media.type || 'image').toLowerCase();
                            return {
                                id: `${media.id}_${mediaIdx}`,
                                mediaId: media.id,
                                url: optimizeAssetUrl(rawUrl, mediaType),
                                mediaType: mediaType,
                                filename: media.title || media.file || 'Media Item',
                                duration: parseInt(media.duration || 10, 10),
                                objectFit: 'cover',
                                widgetType: data.widgetType || '',
                                widgetPlacement: data.widgetPlacement || 'top-right',
                                widgetLink: data.widgetLink || '',
                                tickerText: data.tickerText || '',
                                tickerLabel: data.tickerLabel || ''
                            };
                        }
                    } catch (e) {}
                    return null;
                });
                fetchedAssets = results.filter(Boolean);
            }

            state.orientation = data.orientation || 'horizontal';
            state.widgetType = data.widgetType || '';
            state.widgetPlacement = data.widgetPlacement || 'top-right';
            state.widgetLink = data.widgetLink || '';
            state.tickerText = data.tickerText || data.widgetLink || '';
            state.tickerLabel = data.tickerLabel || 'ANNOUNCEMENT';
            state.activePlaylistObj = data;

            // Compare structure signature (ordered mediaIds + durations + updated timestamp) BEFORE local path rewriting
            const currentSignature = (state.playlist || []).map(a => `${a.mediaId || a.id}:${a.duration}`).join('|');
            const newSignature = fetchedAssets.map(a => `${a.mediaId || a.id}:${a.duration}`).join('|');
            const lastUpdated = localStorage.getItem('signage_tizen_playlist_updated') || '';
            const isDifferent = (currentSignature !== newSignature) || (data.updated && data.updated !== lastUpdated);

            const localAssets = await syncLocalFiles(fetchedAssets);

            state.playlist = localAssets;
            localStorage.setItem(KEYS.PLAYLIST, JSON.stringify(state.playlist));
            if (data.updated) localStorage.setItem('signage_tizen_playlist_updated', data.updated);

            if (isDifferent || !state.isRotating) {
                if (rotationTimeout) clearTimeout(rotationTimeout);
                state.currentAssetIndex = 0;
                state.isRotating = true;
                if (updateUICallback) updateUICallback();
                startPlaylistRotation(state, views, updateUICallback);
            }
        } catch (err) {
            console.error('[Player] Error fetching playlist assets:', err);
            hideDownloadOverlay();
        }
    }

    function stopPlaylistRotation(state, views) {
        if (rotationTimeout) {
            clearTimeout(rotationTimeout);
            rotationTimeout = null;
        }
        if (state) state.isRotating = false;
        if (views && views.videoPlayer) {
            stopAndUnloadVideo(views.videoPlayer);
        }
        if (views && views.imagePlayer1) {
            views.imagePlayer1.style.display = 'none';
            views.imagePlayer1.classList.remove('active');
        }
        if (views && views.imagePlayer2) {
            views.imagePlayer2.style.display = 'none';
            views.imagePlayer2.classList.remove('active');
        }
        if (window.SignageWidgets) {
            window.SignageWidgets.hideAllWidgets();
        }
    }

    return {
        stopAndUnloadVideo,
        stopPlaylistRotation,
        syncLocalFiles,
        startPlaylistRotation,
        advancePlaylist,
        fetchPlaylist
    };
})();
