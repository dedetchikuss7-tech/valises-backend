export const EVIDENCE_MAX_FILES = 5;
export const EVIDENCE_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const EVIDENCE_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export function getMimeFromFilename(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_MIME[ext] ?? null;
}

export function isAllowedMime(mime: string): boolean {
  return EVIDENCE_ALLOWED_MIMES.has(mime);
}
