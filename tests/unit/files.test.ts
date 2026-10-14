import { describe, expect, it } from 'vitest';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, isPreviewable, isPreviewMime, mimeTypeFor, validateFile } from '@/lib/domain/files';

describe('validateFile', () => {
  it('accepts upper-case extension', () => {
    expect(validateFile({ name: 'SLIDES.PDF', size: 1000 })).toEqual({ ok: true });
  });
  it('only the last extension counts', () => {
    expect(validateFile({ name: 'notes.pdf.exe', size: 1000 }).ok).toBe(false);
  });
  it('rejects names without extension', () => {
    expect(validateFile({ name: 'noext', size: 1000 }).ok).toBe(false);
    expect(validateFile({ name: 'trailing.', size: 1000 }).ok).toBe(false);
  });
  it('enforces 50MB limit inclusive', () => {
    expect(validateFile({ name: 'a.pdf', size: 52_428_800 }).ok).toBe(true);
    expect(validateFile({ name: 'a.pdf', size: 52_428_801 })).toEqual({ ok: false, reason: '파일은 50MB까지 올릴 수 있어요' });
  });
  it('rejects disallowed type', () => {
    expect(validateFile({ name: 'a.exe', size: 10 })).toEqual({ ok: false, reason: '올릴 수 없는 파일 형식이에요' });
  });
  it('accepts Korean spaced names', () => {
    expect(validateFile({ name: '운영체제 1주차.pdf', size: 10 })).toEqual({ ok: true });
  });
});

describe('isPreviewable', () => {
  it('previews pdf and images only', () => {
    expect(isPreviewable('x.JPG')).toBe(true);
    expect(isPreviewable('x.pdf')).toBe(true);
    expect(isPreviewable('x.png')).toBe(true);
    expect(isPreviewable('x.jpeg')).toBe(true);
    expect(isPreviewable('x.pptx')).toBe(false);
    expect(isPreviewable('noext')).toBe(false);
  });
});

describe('mimeTypeFor', () => {
  it('derives the content type from the last extension, case-insensitive', () => {
    expect(mimeTypeFor('SLIDES.PDF')).toBe('application/pdf');
    expect(mimeTypeFor('a.png')).toBe('image/png');
    expect(mimeTypeFor('a.jpg')).toBe('image/jpeg');
    expect(mimeTypeFor('a.jpeg')).toBe('image/jpeg');
    expect(mimeTypeFor('a.txt')).toBe('text/plain');
    expect(mimeTypeFor('보고서.hwp')).toBe('application/x-hwp');
    expect(mimeTypeFor('x.pdf.html')).toBe('application/octet-stream');
    expect(mimeTypeFor('a.constructor')).toBe('application/octet-stream');
  });
  it('has a type for every allowed extension, and the allow-list is exactly those types', () => {
    for (const ext of ALLOWED_EXTENSIONS) expect(mimeTypeFor(`a.${ext}`)).not.toBe('application/octet-stream');
    expect([...ALLOWED_MIME_TYPES].sort()).toEqual([...new Set(ALLOWED_EXTENSIONS.map((e) => mimeTypeFor(`a.${e}`)))].sort());
  });
});

describe('isPreviewMime', () => {
  it('only pdf, png and jpeg preview', () => {
    expect(isPreviewMime('application/pdf')).toBe(true);
    expect(isPreviewMime('image/png')).toBe(true);
    expect(isPreviewMime('image/jpeg')).toBe(true);
    expect(isPreviewMime('text/html')).toBe(false);
    expect(isPreviewMime('image/svg+xml')).toBe(false);
    expect(isPreviewMime(null)).toBe(false);
  });
});
