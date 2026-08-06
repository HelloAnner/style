export function shareFileUrl(token: string, filePath: string, thumb = false): string {
  const cleanPath = filePath.replace(/^\/+/, '');
  const encoded = cleanPath.split('/').map(encodeURIComponent).join('/');
  const qs = thumb ? '?thumb=true' : '';
  return `/api/v1/share/${token}/files/${encoded}${qs}`;
}

export function shareFilePreviewUrl(token: string, filePath: string): string {
  return shareFileUrl(token, filePath);
}

export function shareFileThumbUrl(token: string, filePath: string): string {
  return shareFileUrl(token, filePath, true);
}

export function shareFileDownloadUrl(token: string, filePath: string): string {
  const cleanPath = filePath.replace(/^\/+/, '');
  const encoded = cleanPath.split('/').map(encodeURIComponent).join('/');
  return `/api/v1/share/${token}/files/${encoded}?disposition=attachment`;
}
