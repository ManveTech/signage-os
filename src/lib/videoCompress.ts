import {
  ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality, canEncodeVideo
} from 'mediabunny';

/**
 * Re-encodes a video on the uploader's own device before it is uploaded, so
 * a 4K phone clip goes up (and down to every TV) as a 1080p file a fraction
 * of the size.
 *
 * Uses the device's hardware encoder through WebCodecs (works in Chrome,
 * Edge, recent Safari/Firefox and the Android app's WebView). Compression is
 * an optimisation only: whenever it isn't supported, isn't worth it, or goes
 * wrong in any way, this returns null and the original file is uploaded.
 *
 * Loaded on demand from mediaUpload.ts, so the library only downloads once
 * someone actually picks a video.
 */

/** Nothing a signage TV shows needs more; most boxes struggle with 4K anyway. */
const MAX_LONG_SIDE = 1920;
const MAX_SHORT_SIDE = 1080;
/** About 6 Mbps at 1080p — clean for signage content. */
const BITS_PER_PIXEL_PER_SECOND = 3;
/** Already this close to the target? Re-encoding would only cost quality. */
const SKIP_BELOW_TARGET_RATIO = 1.5;
/** The output is held in memory until it is uploaded. */
const MAX_OUTPUT_BYTES = 200 * 1024 * 1024;
/** Only keep the result if it saves at least this much. */
const KEEP_IF_UNDER_RATIO = 0.8;
const MAX_FRAME_RATE = 30;
/** Gives up if the encoder makes no progress for this long. */
const STALL_TIMEOUT_MS = 30_000;

export interface CompressedVideo {
  file: File;
  width: number;
  height: number;
  duration: number;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function compressVideo(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<CompressedVideo | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return null;

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const duration = await input.computeDuration();
    if (!duration || duration <= 0) return null;

    const srcW = track.displayWidth;
    const srcH = track.displayHeight;
    const landscape = srcW >= srcH;
    const scale = Math.min(
      1,
      (landscape ? MAX_LONG_SIDE : MAX_SHORT_SIDE) / srcW,
      (landscape ? MAX_SHORT_SIDE : MAX_LONG_SIDE) / srcH
    );
    const width = even(srcW * scale);
    const height = even(srcH * scale);
    const bitrate = Math.round(width * height * BITS_PER_PIXEL_PER_SECOND);

    const sourceBitrate = (file.size * 8) / duration;
    if (scale === 1 && sourceBitrate <= bitrate * SKIP_BELOW_TARGET_RATIO) return null;
    if ((bitrate * duration) / 8 > MAX_OUTPUT_BYTES) return null;

    const stats = await track.computePacketStats(60).catch(() => null);
    const frameRate = stats && stats.averagePacketRate > MAX_FRAME_RATE + 1 ? MAX_FRAME_RATE : undefined;

    const quality = new Quality({ bitrate, bitrateMode: 'variable' });
    if (!(await canEncodeVideo('avc', { width, height, quality, frameRate }))) return null;

    const output = new Output({
      // Moov at the front, so TVs can start playing before the whole file is in.
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget()
    });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: {
        codec: 'avc',
        width,
        height,
        fit: 'fill',
        quality,
        frameRate,
        // Bake phone rotation into the frames; not every TV player honours the metadata.
        allowTransformationMetadata: false
      },
      // AAC audio is copied as is; anything else is re-encoded to AAC.
      audio: { codec: 'aac' }
    });
    // A dropped track would mean a silent (or blank) video — upload the original instead.
    if (!conversion.isValid || conversion.discardedTracks.length > 0) return null;

    const bump = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => { void conversion.cancel(); }, STALL_TIMEOUT_MS);
    };
    conversion.onProgress = (p) => { bump(); onProgress?.(Math.min(1, p)); };
    bump();
    await conversion.execute();

    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer || buffer.byteLength >= file.size * KEEP_IF_UNDER_RATIO) return null;

    const base = file.name.replace(/\.[^/.]+$/, '');
    return {
      file: new File([buffer], `${base}.mp4`, { type: 'video/mp4' }),
      width,
      height,
      duration: Math.round(duration) || 15
    };
  } catch (err) {
    console.warn('[upload] video compression skipped, uploading the original:', err);
    return null;
  } finally {
    clearTimeout(watchdog);
    input.dispose();
  }
}
