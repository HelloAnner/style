import type { ReplayFileItem } from './ReplayEngine';

function sessionFileKey(path: string): string {
  return path.replace(/^\/+/, '').replace(/^files\//, '');
}

export function buildShareWorkspaceFiles(
  manifestFiles: ReplayFileItem[],
  activeFiles: ReplayFileItem[],
): ReplayFileItem[] {
  const manifestFilesByKey = new Map(
    manifestFiles.map((file) => [sessionFileKey(file.path), file]),
  );
  const merged: ReplayFileItem[] = [];
  const seen = new Set<string>();

  for (const file of activeFiles) {
    const key = sessionFileKey(file.path);
    const manifestFile = manifestFilesByKey.get(key);
    if (!manifestFile || seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...file, ...manifestFile });
  }

  for (const file of manifestFiles) {
    const key = sessionFileKey(file.path);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(file);
  }

  return merged;
}
