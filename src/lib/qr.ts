import qrcode from 'qrcode-generator';

// Encode as UTF-8 so links with non-English characters scan correctly.
(qrcode as any).stringToBytes = (qrcode as any).stringToBytesFuncs['UTF-8'];

/**
 * A QR code drawn here in the browser (no outside service): an SVG data
 * address for an <img>, or '' when there's nothing to encode.
 */
export function qrDataUrl(text: string): string {
  const value = text.trim();
  if (!value) return '';
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true } as any);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
