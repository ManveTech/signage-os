import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Turning a PDF into the page images a screen can actually show.
 *
 * A TV player only knows how to display an image or play a video — it has no
 * PDF renderer, and giving it one would mean shipping a new APK to every
 * screen in the field. So the pages are rasterised here, in the browser that
 * already has the file open, exactly as videos are already compressed here
 * before they go up. The player never learns that PDFs exist.
 *
 * This module is imported lazily. pdf.js and its worker are ~1MB that has no
 * business in the bundle a client downloads to watch a playlist.
 */

/**
 * The longest side of a rendered page, in pixels.
 *
 * Deliberately the longest side rather than the width. Scaling by width
 * alone gave an A4 portrait page 1920×2717 — five megapixels, taller than
 * any screen it could play on, and the JPEG encode of that one page cost
 * six seconds where the render itself cost less than one. Bounding the long
 * side gives a landscape slide 1920×1080 and a portrait page 1358×1920:
 * both sharp on a screen mounted either way, neither oversized.
 */
const MAX_SIDE = 1920;

/**
 * A hard stop on pages. Each page becomes its own media item and its own
 * playlist slide, so a 400-page catalogue uploaded by accident would quietly
 * produce 400 library entries and a playlist no one can edit. Someone who
 * genuinely wants that can split the file.
 */
export const MAX_PDF_PAGES = 50;

export type PdfPage = {
  blob: Blob;
  width: number;
  height: number;
  /** 1-based, as printed on the page — this is shown to people. */
  pageNumber: number;
};

export type PdfRender = {
  pages: PdfPage[];
  /** Pages the document actually has, which may exceed what was rendered. */
  pageCount: number;
};

/** A password-protected or corrupt file, said in terms the uploader can act on. */
function readableError(err: unknown): Error {
  const name = (err as { name?: string })?.name || '';
  if (name === 'PasswordException') {
    return new Error('This PDF is password-protected — remove the password and try again');
  }
  if (name === 'InvalidPDFException') {
    return new Error("This file isn't a readable PDF — try re-exporting it");
  }
  const message = err instanceof Error ? err.message : '';
  return new Error(message || 'This PDF could not be read');
}

/**
 * Renders up to {@link MAX_PDF_PAGES} pages of `file` to JPEG blobs.
 *
 * `onProgress` reports 0–1 across the whole document. Throws with a readable
 * message; the caller treats that as the upload failing, because a PDF whose
 * pages could not be rendered has nothing a screen could show.
 */
export async function renderPdfPages(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<PdfRender> {
  const pdfjs = await import('pdfjs-dist');
  // Set every time rather than once at module scope: the worker is shared
  // process-wide and a second caller must not race on an unset value.
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const bytes = await file.arrayBuffer();
  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      // A PDF is an untrusted document from a client. These two are the parts
      // of the format that execute or fetch rather than just draw.
      isEvalSupported: false,
      disableAutoFetch: true
    }).promise;
  } catch (err) {
    throw readableError(err);
  }

  const pageCount = doc.numPages;
  const wanted = Math.min(pageCount, MAX_PDF_PAGES);
  const pages: PdfPage[] = [];

  try {
    for (let n = 1; n <= wanted; n++) {
      const page = await doc.getPage(n);
      // viewport(1) is the page's own size in *points* — 72 to the inch, so
      // an A4 page is 595 wide, which is why this scales up rather than
      // down. The content is vector, so rendering it larger re-draws it at
      // that resolution instead of magnifying pixels. The scale is derived
      // from the page's own size, so A4 portrait and a 16:9 slide both come
      // out right.
      const base = page.getViewport({ scale: 1 });
      const scale = MAX_SIDE / Math.max(base.width, base.height);
      const viewport = page.getViewport({ scale });
      const width = Math.round(viewport.width);
      const height = Math.round(viewport.height);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This device could not render the PDF pages');
      // PDF pages are transparent where nothing is drawn, and JPEG has no
      // alpha — without this, blank areas come out black on the screen.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      page.cleanup();

      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      // Free it before the next page: fifty 1920px canvases held at once is
      // enough to run a phone out of memory.
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) throw new Error(`Page ${n} could not be converted to an image`);

      pages.push({ blob, width, height, pageNumber: n });
      onProgress?.(n / wanted);
    }
  } finally {
    await doc.destroy();
  }

  return { pages, pageCount };
}
