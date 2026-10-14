export const MAX_FILE_BYTES = 52_428_800;

export const ALLOWED_EXTENSIONS: readonly string[] = [
  'pdf', 'ppt', 'pptx', 'doc', 'docx', 'hwp', 'hwpx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg', 'zip',
];

const PREVIEWABLE = ['pdf', 'png', 'jpg', 'jpeg'];

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
