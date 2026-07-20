export interface PlaylistCompileProgress {
  progress: number; // Percentage (0-100)
  status: string; // User-facing status message
}

export async function compilePlaylistToVideo(
  slides: any[],
  mediaList: any[],
  onProgress?: (progress: PlaylistCompileProgress) => void
): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      if (onProgress) onProgress({ progress: 5, status: 'Preloading assets...' });

      // Preload all slide images and warm video elements in parallel
      const loadedAssets = await Promise.all(
        slides.map(async (slide, idx) => {
          const media = mediaList.find((m) => m.id === slide.mediaId);
          if (!media) return null;

          if (media.type === 'video') {
            return new Promise((res) => {
              const video = document.createElement('video');
              video.src = media.fileUrl || media.thumbnail;
              video.crossOrigin = 'anonymous';
              video.muted = true;
              video.playsInline = true;
              video.preload = 'auto';

              const handleReady = () => {
                video.removeEventListener('loadeddata', handleReady);
                video.removeEventListener('error', handleError);
                res({ type: 'video', element: video, duration: slide.duration || 10, media });
              };
              const handleError = () => {
                video.removeEventListener('loadeddata', handleReady);
                video.removeEventListener('error', handleError);
                res(null);
              };

              video.addEventListener('loadeddata', handleReady);
              video.addEventListener('error', handleError);
              // Trigger load
              video.load();
            });
          } else {
            return new Promise((res) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                res({ type: 'image', element: img, duration: slide.duration || 10, media });
              };
              img.onerror = () => {
                res(null);
              };
              img.src = media.fileUrl || media.thumbnail;
            });
          }
        })
      );

      const validAssets = loadedAssets.filter((a) => a !== null) as any[];
      if (validAssets.length === 0) {
        return reject(new Error('No valid media items to compile in playlist'));
      }

      if (onProgress) onProgress({ progress: 15, status: 'Initializing recorder...' });

      // Set up canvas and record stream
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context not supported'));

      // Check supported recording MIME types
      let mimeType = 'video/webm;codecs=vp9';
      let extension = '.webm';
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264')) {
        mimeType = 'video/mp4;codecs=h264';
        extension = '.mp4';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        extension = '.mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
        mimeType = 'video/webm;codecs=h264';
        extension = '.webm';
      }

      const stream = canvas.captureStream(30); // Capture at 30 FPS
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 1200000 // 1.2 Mbps for optimized size and high 1080p quality
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        if (onProgress) onProgress({ progress: 100, status: 'Compilation finished!' });
        resolve({
          blob: finalBlob,
          fileName: `playlist_compiled_${Date.now()}${extension}`,
          mimeType
        });
      };

      recorder.start();

      let currentAssetIndex = 0;
      let frameCount = 0;
      const fps = 30;

      // Start recursive frame drawer
      const drawFrame = async () => {
        if (currentAssetIndex >= validAssets.length) {
          recorder.stop();
          return;
        }

        const asset = validAssets[currentAssetIndex];
        const durationFrames = (asset.duration || 10) * fps;

        // Clear canvas with pitch black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (asset.type === 'video') {
          const video = asset.element as HTMLVideoElement;
          if (video.paused && frameCount === 0) {
            video.currentTime = 0;
            try {
              await video.play();
            } catch (err) {
              console.warn('Playback error on compilation pre-render:', err);
            }
          }
          // Draw current video frame onto canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } else {
          // Draw image respecting cover aspect ratio
          const img = asset.element as HTMLImageElement;
          const iw = img.naturalWidth;
          const ih = img.naturalHeight;
          const cw = canvas.width;
          const ch = canvas.height;
          const scale = Math.max(cw / iw, ch / ih);
          const nw = iw * scale;
          const nh = ih * scale;
          const nx = (cw - nw) / 2;
          const ny = (ch - nh) / 2;
          ctx.drawImage(img, nx, ny, nw, nh);
        }

        // Apply slide-in fade transition effect
        const transitionFrames = 15; // 0.5s fade
        if (frameCount < transitionFrames) {
          const alpha = 1 - frameCount / transitionFrames;
          ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        frameCount++;

        // Report progress
        const overallFrames = validAssets.reduce((acc, a) => acc + (a.duration || 10) * fps, 0);
        const processedFrames = validAssets.slice(0, currentAssetIndex).reduce((acc, a) => acc + (a.duration || 10) * fps, 0) + frameCount;
        const percent = Math.min(95, Math.round(15 + (processedFrames / overallFrames) * 80));
        
        if (onProgress) {
          onProgress({
            progress: percent,
            status: `Encoding slide ${currentAssetIndex + 1}/${validAssets.length} (${percent}%)`
          });
        }

        if (frameCount >= durationFrames) {
          if (asset.type === 'video') {
            (asset.element as HTMLVideoElement).pause();
          }
          currentAssetIndex++;
          frameCount = 0;
        }

        // Request next frame
        setTimeout(drawFrame, 1000 / fps);
      };

      // Begin loop
      drawFrame();
    } catch (err: any) {
      reject(err);
    }
  });
}
