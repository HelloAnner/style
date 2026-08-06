export function buildCurrentOriginUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, window.location.origin).toString();
}
