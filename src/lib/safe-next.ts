/** Returns `next` only if it is a same-origin relative path; otherwise `/`. */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  // Browsers strip tabs/newlines and treat backslash as slash, so "/\evil.com" or "/\t/evil.com" escape the origin.
  if (/[\\\u0000-\u001f]/.test(next)) return "/";
  return next;
}
