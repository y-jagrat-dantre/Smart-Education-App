export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export function decodedBase64ByteLength(value: string) {
  const payload = value.replace(/^data:[^,]*;base64,/i, '').replace(/\s/g, '');
  if (!payload || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload) || payload.length % 4 === 1) return null;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  if (padding && payload.length % 4 !== 0) return null;
  return Math.floor(payload.length * 3 / 4) - padding;
}

export function pdfByteLength(reportedSize: number | undefined, base64: string) {
  if (typeof reportedSize === 'number' && Number.isFinite(reportedSize) && reportedSize >= 0) return reportedSize;
  return decodedBase64ByteLength(base64);
}
