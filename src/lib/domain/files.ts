export const MAX_FILE_BYTES = 52_428_800;

export const ALLOWED_EXTENSIONS: readonly string[] = [
  'pdf', 'ppt', 'pptx', 'doc', 'docx', 'hwp', 'hwpx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg', 'zip',
];

const PREVIEWABLE = ['pdf', 'png', 'jpg', 'jpeg'];

/**
 * Content type pinned from the extension (never the browser's guess). Must match the bucket's
 * allowed_mime_types in supabase/migrations/0002_hardening.sql.
 * hwp/hwpx have no registered type; the x- names are used so octet-stream need not be allowed.
 */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  hwp: 'application/x-hwp',
  hwpx: 'application/x-hwpx',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  zip: 'application/zip',
};

export const ALLOWED_MIME_TYPES: readonly string[] = [...new Set(Object.values(MIME_BY_EXTENSION))];

const PREVIEW_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

function extensionOf(name: string): string | null {
  const i = name.lastIndexOf('.');
  if (i === -1 || i === name.length - 1) return null;
  return name.slice(i + 1).toLowerCase();
}

export function validateFile(f: { name: string; size: number }): { ok: true } | { ok: false; reason: string } {
  const ext = extensionOf(f.name);
  if (ext === null || !ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, reason: '올릴 수 없는 파일 형식이에요' };
  }
  if (f.size > MAX_FILE_BYTES) {
    return { ok: false, reason: '파일은 50MB까지 올릴 수 있어요' };
  }
  return { ok: true };
}

export function isPreviewable(name: string): boolean {
  const ext = extensionOf(name);
  return ext !== null && PREVIEWABLE.includes(ext);
}

/** The upload/stored content type for a file name; unknown extensions get application/octet-stream. */
export function mimeTypeFor(name: string): string {
  const ext = extensionOf(name);
  return ext !== null && Object.hasOwn(MIME_BY_EXTENSION, ext) ? MIME_BY_EXTENSION[ext] : 'application/octet-stream';
}

/** Only these stored types may be opened inline (preview); everything else downloads. */
export function isPreviewMime(mime: string | null | undefined): boolean {
  return typeof mime === 'string' && PREVIEW_MIME_TYPES.includes(mime);
}
