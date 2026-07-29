/**
 * SignageOS Player - Ultra-Lightweight Playlist Engine
 */

window.SignagePlayer = (function () {
    const { KEYS, getPocketBaseUrl } = window.SignageConfig;
    const { getFileURI } = window.SignageStorage;

    let rotationTimeout = null;
    let rotationToken = 0;
    let activeImageNum = 1;

    async function syncLocalFiles(assets) {
        if (!window.tizen || !window.tizen.filesystem) {
            return assets;
        }

        try {
            const dir = await new Promise((resolve, reject) => {
                window.tizen.filesystem.resolve("wgt-private", resolve, reject, "rw");
            });

            for (let i = 0; i < assets.length; i++) {
                const asset = assets[i];
                if (!asset.url || asset.url.startsWith('file://')) continue;

                let ext = asset.mediaType === 'video' ? 'mp4' : 'png';
                if (asset.url.includes('.jpg') || asset.url.includes('.jpeg')) ext = 'jpg';
                else if (asset.url.includes('.gif')) ext = 'gif';
                else if (asset.url.includes('.webp')) ext = 'webp';

                const filename = `asset_${asset.id}.${ext}`;
                try {
                    const file = dir.resolve(filename);
                    asset.url = getFileURI(file);
                } catch (_) {
                    // If not found locally, fetch and save
                    try {
                        const response = await fetch(asset.url);
                        if (response.ok) {
                            const blob = await response.blob();
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
                                        if (typeof stream.writeBase64 === 'function') {
                                            stream.writeBase64(base64Data);
                                            stream.close();
                                            resolve();
                                        } else {
                                            stream.close();
                                            reject(new Error("writeBase64 not supported"));
                                        }
                                    } catch (e) {
                                        stream.close();
                                        reject(e);
                                    }
                                }, reject);
                            });
                            asset.url = getFileURI(file);
                        }
                    } catch (dlErr) {
                        console.warn(`Local caching failed for ${filename}, falling back to remote URL:`, dlErr);
                    }
                }
            }
        } catch (err) {
            console.error("Local filesystem access error:", err);
        }

        return assets;
    }

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

        console.log(`[Player] Slide ${state.currentAssetIndex + 1}/${state.playlist.length}: ${asset.filename} (${asset.mediaType}, ${asset.duration}s)`);

        const duration = Math.max(parseInt(asset.duration, 10) || 10, 2) * 1000;

        if (asset.mediaType === 'video') {
            // Hide image elements
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
                console.warn("[Player] Video play failed, falling back muted:", e);
                video.muted = true;
                video.play().catch(() => onVideoError(e));
            });

            // Safety timer backup for video playback
            rotationTimeout = setTimeout(() => {
                if (currentToken === rotationToken && !videoDone) {
                    console.warn("[Player] Video safety timer fired");
                    onVideoEnd();
                }
            }, duration + 5000);

        } else {
            // Image playback
            if (views.videoPlayer) {
                views.videoPlayer.style.display = 'none';
                try { views.videoPlayer.pause(); } catch (_) {}
            }

            const activeImg = activeImageNum === 1 ? views.imagePlayer1 : views.imagePlayer2;
            const inactiveImg = activeImageNum === 1 ? views.imagePlayer2 : views.imagePlayer1;
            activeImageNum = activeImageNum === 1 ? 2 : 1;

            if (activeImg) {
                activeImg.style.objectFit = asset.objectFit || 'cover';
                activeImg.style.display = 'block';
                activeImg.classList.add('active');
                activeImg.src = asset.url;
            }

            if (inactiveImg) {
                inactiveImg.classList.remove('active');
                setTimeout(() => {
                    if (currentToken === rotationToken && inactiveImg.parentNode) {
                        inactiveImg.style.display = 'none';
                    }
                }, 350);
            }

            // Background pre-fetch next image into browser cache without DOM pollution
            if (state.playlist.length > 1) {
                const nextIdx = (state.currentAssetIndex + 1) % state.playlist.length;
                const nextAsset = state.playlist[nextIdx];
                if (nextAsset && nextAsset.mediaType === 'image' && nextAsset.url) {
                    const preloadImg = new Image();
                    preloadImg.src = nextAsset.url;
                }
            }

            rotationTimeout = setTimeout(() => {
                if (currentToken === rotationToken) {
                    advancePlaylist(state, views, updateUICallback);
                }
            }, duration);
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
                const results = await Promise.all(slides.map(async (slide) => {
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
                }));
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
                const results = await Promise.all(data.mediaIds.map(async (mediaId) => {
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
                }));
                fetchedAssets = results.filter(Boolean);
            }

            state.orientation = data.orientation || 'horizontal';

            const localAssets = await syncLocalFiles(fetchedAssets);
            const currentKeys = (state.playlist || []).map(a => a.id + '_' + a.url);
            const newKeys = localAssets.map(a => a.id + '_' + a.url);
            const isDifferent = JSON.stringify(newKeys) !== JSON.stringify(currentKeys);

            state.playlist = localAssets;
            localStorage.setItem(KEYS.PLAYLIST, JSON.stringify(state.playlist));

            if (isDifferent || !state.isRotating) {
                state.currentAssetIndex = 0;
                state.isRotating = true;
                if (updateUICallback) updateUICallback();
                startPlaylistRotation(state, views, updateUICallback);
            }
        } catch (err) {
            console.error("[Player] Error syncing playlist assets:", err);
        }
    }

    return {
        syncLocalFiles,
        startPlaylistRotation,
        advancePlaylist,
        fetchPlaylist
    };
})();
