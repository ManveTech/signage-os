/**
 * SignageOS Player - High Performance Download & Drift-Corrected Playlist Rotation Engine
 */

window.SignagePlayer = (function () {
    const { KEYS, SERVER_URL, getPocketBaseUrl } = window.SignageConfig;
    const { getFileURI } = window.SignageStorage;

    let rotationTimeout = null;
    let rotationToken = 0;
    let activeImageNum = 1;
    let isDownloading = false;
    let expectedTargetTime = 0;

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

    /**
     * Batch execution helper (concurrency limit = 5) to prevent launching hundreds of simultaneous requests
     */
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

    async function syncLocalFiles(assets) {
        if (!assets || assets.length === 0) return assets;
        if (isDownloading) return assets;

        isDownloading = true;
        const totalAssets = assets.length;
        const isTizen = window.tizen && window.tizen.filesystem;
        let tizenDir = null;

        if (isTizen) {
            try {
                tizenDir = await new Promise((resolve, reject) => {
                    window.tizen.filesystem.resolve("wgt-private", resolve, reject, "rw");
                });
            } catch (e) {
                console.warn("[Player] Tizen storage resolve error:", e);
            }
        }

        const missingAssets = [];
        let cachedCount = 0;

        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            if (!asset.url) continue;

            if (tizenDir) {
                let ext = asset.mediaType === 'video' ? 'mp4' : 'png';
                if (asset.url.includes('.jpg') || asset.url.includes('.jpeg')) ext = 'jpg';
                else if (asset.url.includes('.gif')) ext = 'gif';
                else if (asset.url.includes('.webp')) ext = 'webp';

                const filename = `asset_${asset.id}.${ext}`;
                try {
                    const file = tizenDir.resolve(filename);
                    asset.url = getFileURI(file);
                    cachedCount++;
                } catch (_) {
                    missingAssets.push({ index: i, asset, filename });
                }
            } else if (asset.url.startsWith('blob:') || asset.url.startsWith('file:')) {
                cachedCount++;
            } else {
                missingAssets.push({ index: i, asset, filename: asset.filename || `asset_${asset.id}` });
            }
        }

        if (missingAssets.length > 0) {
            console.log(`[Player] Total Assets: ${totalAssets}, Cached: ${cachedCount}, Downloading: ${missingAssets.length}`);
            updateDownloadProgress(cachedCount, totalAssets, '');

            for (let k = 0; k < missingAssets.length; k++) {
                const { asset, filename } = missingAssets[k];
                const currentProgressIdx = cachedCount + k + 1;

                try {
                    let response;
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 60000);
                        response = await fetch(asset.url, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        if (!response.ok) throw new Error("Direct fetch failed");
                    } catch (directErr) {
                        console.log(`[Player] Direct download failed for ${asset.url}, using proxy...`);
                        const proxyUrl = `${SERVER_URL}/api/v1/public/proxy-media?url=${encodeURIComponent(asset.url)}`;
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 60000);
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
                            updateDownloadProgress(currentProgressIdx, totalAssets, asset.filename || filename, receivedBytes, contentLength);
                        }
                        blob = new Blob(chunks);
                    } else {
                        blob = await response.blob();
                        updateDownloadProgress(currentProgressIdx, totalAssets, asset.filename || filename, blob.size, blob.size);
                    }

                    if (tizenDir) {
                        const base64Data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });

                        const file = tizenDir.createFile(filename);
                        await new Promise((resolve, reject) => {
                            file.openStream("w", (stream) => {
                                try {
                                    if (typeof stream.writeBase64 === 'function') {
                                        stream.writeBase64(base64Data);
                                        stream.close();
                                        resolve();
                                    } else {
                                        stream.close();
                                        reject(new Error("writeBase64 unavailable"));
                                    }
                                } catch (e) {
                                    stream.close();
                                    reject(e);
                                }
                            }, reject);
                        });

                        asset.url = getFileURI(file);
                    } else {
                        asset.url = URL.createObjectURL(blob);
                    }
                    console.log(`[Player] Successfully downloaded asset ${asset.filename}`);
                } catch (dlErr) {
                    console.error(`[Player] Download failed for asset ${asset.filename}:`, dlErr);
                }
                updateDownloadProgress(currentProgressIdx, totalAssets, asset.filename || filename);
            }
        }

        hideDownloadOverlay();
        isDownloading = false;
        return assets;
    }

    /**
     * Drift-Corrected Playlist Rotation Engine
     */
    function startPlaylistRotation(state, views, updateUICallback) {
        if (rotationTimeout) clearTimeout(rotationTimeout);
        if (!state.playlist || state.playlist.length === 0) return;

        const currentToken = ++rotationToken;
        const asset = state.playlist[state.currentAssetIndex];

        if (!asset) {
            state.currentAssetIndex = 0;
            expectedTargetTime = 0;
            if (state.playlist && state.playlist[0]) {
                startPlaylistRotation(state, views, updateUICallback);
            }
            return;
        }

        const duration = Math.max(parseInt(asset.duration, 10) || 10, 2) * 1000;
        const now = performance.now();

        if (expectedTargetTime === 0) {
            expectedTargetTime = now + duration;
        } else {
            expectedTargetTime += duration;
        }

        let delay = expectedTargetTime - now;
        if (delay < 0) {
            console.warn(`[Player] Execution fell behind by ${Math.abs(delay).toFixed(1)}ms. Resetting timing baseline.`);
            expectedTargetTime = now + duration;
            delay = duration;
        }

        console.log(`[Player] Slide ${state.currentAssetIndex + 1}/${state.playlist.length}: ${asset.filename} (${asset.mediaType}, ${asset.duration}s, delay=${delay.toFixed(0)}ms)`);

        if (asset.mediaType === 'video') {
            if (views.imagePlayer1) views.imagePlayer1.style.display = 'none';
            if (views.imagePlayer2) views.imagePlayer2.style.display = 'none';

            const video = views.videoPlayer;
            if (!video) {
                advancePlaylist(state, views, updateUICallback);
                return;
            }

            video.style.objectFit = asset.objectFit || 'cover';
            video.style.display = 'block';
            video.style.opacity = '1';

            if (video.src !== asset.url) {
                video.src = asset.url;
            }

            let videoDone = false;
            const onVideoEnd = () => {
                if (currentToken !== rotationToken || videoDone) return;
                videoDone = true;
                video.removeEventListener('ended', onVideoEnd);
                video.removeEventListener('error', onVideoError);
                advancePlaylist(state, views, updateUICallback);
            };

            const onVideoError = (err) => {
                console.warn("[Player] Video error:", err);
                if (currentToken !== rotationToken || videoDone) return;
                videoDone = true;
                video.removeEventListener('ended', onVideoEnd);
                video.removeEventListener('error', onVideoError);
                advancePlaylist(state, views, updateUICallback);
            };

            video.addEventListener('ended', onVideoEnd);
            video.addEventListener('error', onVideoError);

            video.play().catch((e) => {
                console.warn("[Player] Muted video fallback...", e);
                video.muted = true;
                video.play().catch(() => onVideoError(e));
            });

            rotationTimeout = setTimeout(() => {
                if (currentToken === rotationToken && !videoDone) {
                    console.warn("[Player] Video safety backup timer fired");
                    onVideoEnd();
                }
            }, Math.max(delay, duration + 3000));

        } else {
            // Video -> Image Memory & Decoded Frame Release Cleanup
            if (views.videoPlayer) {
                views.videoPlayer.style.display = 'none';
                try {
                    views.videoPlayer.pause();
                    views.videoPlayer.removeAttribute('src');
                    views.videoPlayer.load(); // Forces WebKit to release hardware video decoder & frames
                } catch (_) {}
            }

            const activeImg = activeImageNum === 1 ? views.imagePlayer1 : views.imagePlayer2;
            const inactiveImg = activeImageNum === 1 ? views.imagePlayer2 : views.imagePlayer1;
            activeImageNum = activeImageNum === 1 ? 2 : 1;

            if (activeImg) {
                activeImg.style.objectFit = asset.objectFit || 'cover';
                activeImg.style.display = 'block';
                activeImg.style.zIndex = '3';
                activeImg.classList.add('active');

                if (activeImg.src !== asset.url) {
                    activeImg.src = asset.url;
                }

                // Decode current image when presented
                if (typeof activeImg.decode === 'function') {
                    activeImg.decode().catch(() => {});
                }

                if (inactiveImg) {
                    inactiveImg.classList.remove('active');
                    inactiveImg.style.zIndex = '1';
                }
            }

            // Schedule drift-corrected timer
            rotationTimeout = setTimeout(() => {
                if (currentToken === rotationToken) {
                    advancePlaylist(state, views, updateUICallback);
                }
            }, delay);

            // Preload ONLY the next single image into inactive element (avoiding full playlist memory decoding)
            if (state.playlist.length > 1 && inactiveImg) {
                const nextIndex = (state.currentAssetIndex + 1) % state.playlist.length;
                const nextAsset = state.playlist[nextIndex];
                if (nextAsset && nextAsset.mediaType === 'image' && nextAsset.url) {
                    if (inactiveImg.src !== nextAsset.url) {
                        inactiveImg.src = nextAsset.url;
                        if (typeof inactiveImg.decode === 'function') {
                            inactiveImg.decode().catch(() => {});
                        }
                    }
                }
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

            // Batched media fetching (concurrency batch size = 5)
            if (Array.isArray(slides) && slides.length > 0) {
                const results = await fetchInBatches(slides, 5, async (slide) => {
                    try {
                        const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${slide.mediaId}`);
                        if (mediaRes.ok) {
                            const media = await mediaRes.json();
                            const rawUrl = media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail;
                            return {
                                id: media.id,
                                url: rawUrl,
                                mediaType: (media.type || 'image').toLowerCase(),
                                filename: media.title || media.file || 'Media Item',
                                duration: parseInt(slide.duration || media.duration || 10, 10),
                                objectFit: slide.objectFit || 'cover'
                            };
                        }
                    } catch (e) {}
                    return null;
                });
                fetchedAssets = results.filter(Boolean);
            } else if (data.assetsJson && data.assetsJson.length > 0) {
                data.assetsJson.forEach((pbAsset) => {
                    fetchedAssets.push({
                        id: pbAsset.id,
                        url: pbAsset.url,
                        mediaType: (pbAsset.mediaType || 'image').toLowerCase(),
                        filename: pbAsset.filename || 'Asset',
                        duration: parseInt(pbAsset.duration || 10, 10),
                        objectFit: pbAsset.objectFit || 'cover'
                    });
                });
            } else if (data.files && data.files.length > 0) {
                data.files.forEach((fileName, index) => {
                    const rawUrl = `${POCKETBASE_URL}/api/files/playlists/${playlistId}/${fileName}`;
                    fetchedAssets.push({
                        id: `${playlistId}_${index}`,
                        url: rawUrl,
                        mediaType: "image",
                        filename: fileName,
                        duration: 10,
                        objectFit: 'cover'
                    });
                });
            } else if (data.mediaIds && data.mediaIds.length > 0) {
                const results = await fetchInBatches(data.mediaIds, 5, async (mediaId) => {
                    try {
                        const mediaRes = await fetch(`${POCKETBASE_URL}/api/collections/media_items/records/${mediaId}`);
                        if (mediaRes.ok) {
                            const media = await mediaRes.json();
                            const rawUrl = media.file ? `${POCKETBASE_URL}/api/files/media_items/${media.id}/${media.file}` : media.thumbnail;
                            return {
                                id: media.id,
                                url: rawUrl,
                                mediaType: (media.type || 'image').toLowerCase(),
                                filename: media.title || media.file || 'Media Item',
                                duration: parseInt(media.duration || 10, 10),
                                objectFit: 'cover'
                            };
                        }
                    } catch (e) {}
                    return null;
                });
                fetchedAssets = results.filter(Boolean);
            }

            state.orientation = data.orientation || 'horizontal';

            const localAssets = await syncLocalFiles(fetchedAssets);

            const currentIds = (state.playlist || []).map(a => a.id).join(',');
            const newIds = localAssets.map(a => a.id).join(',');
            const isDifferent = currentIds !== newIds;

            state.playlist = localAssets;
            localStorage.setItem(KEYS.PLAYLIST, JSON.stringify(state.playlist));
            if (data.updated) localStorage.setItem('signage_tizen_playlist_updated', data.updated);

            if (isDifferent || !state.isRotating) {
                state.currentAssetIndex = 0;
                expectedTargetTime = 0;
                state.isRotating = true;
                if (updateUICallback) updateUICallback();
                startPlaylistRotation(state, views, updateUICallback);
            }
        } catch (err) {
            console.error("[Player] Error fetching playlist assets:", err);
            hideDownloadOverlay();
        }
    }

    return {
        syncLocalFiles,
        startPlaylistRotation,
        advancePlaylist,
        fetchPlaylist
    };
})();
