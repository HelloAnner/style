export type WorkspaceFileCategory =
  | 'image'
  | 'document'
  | 'pdf'
  | 'code'
  | 'spreadsheet'
  | 'video'
  | 'audio'
  | 'presentation'
  | 'archive'
  | 'unknown';

const CATEGORY_BY_EXTENSION: Record<string, WorkspaceFileCategory> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  bmp: 'image',
  ico: 'image',
  pdf: 'pdf',
  csv: 'spreadsheet',
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
  ods: 'spreadsheet',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
  ogg: 'audio',
  flac: 'audio',
  pptx: 'presentation',
  ppt: 'presentation',
  key: 'presentation',
  odp: 'presentation',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  py: 'code',
  js: 'code',
  ts: 'code',
  jsx: 'code',
  tsx: 'code',
  go: 'code',
  java: 'code',
  c: 'code',
  cpp: 'code',
  rs: 'code',
  rb: 'code',
  php: 'code',
  html: 'code',
  css: 'code',
  sql: 'code',
  sh: 'code',
  md: 'document',
  markdown: 'document',
  txt: 'document',
  json: 'document',
  yaml: 'document',
  yml: 'document',
  toml: 'document',
  xml: 'document',
  log: 'document',
  doc: 'document',
  docx: 'document',
  rst: 'document',
};

export function getWorkspaceFileExtension(fileName: string): string {
  const cleanName = fileName.trim();
  const ext = cleanName.split('.').pop()?.toLowerCase();
  if (!ext || ext === cleanName.toLowerCase()) {
    return '';
  }
  return ext;
}

export function getWorkspaceFileCategory(fileName: string): WorkspaceFileCategory {
  const ext = getWorkspaceFileExtension(fileName);
  return CATEGORY_BY_EXTENSION[ext] ?? 'unknown';
}

export function getWorkspaceFileTypeLabel(fileName: string): string {
  const ext = getWorkspaceFileExtension(fileName);
  return ext ? ext.toUpperCase() : 'FILE';
}
