const HIGHLIGHT_KEY = 'moss_board_generated_session_highlights';

function readHighlightIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(HIGHLIGHT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeHighlightIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(Array.from(ids)));
}

export function markBoardGeneratedSessionHighlight(sessionId: string) {
  const ids = readHighlightIds();
  ids.add(sessionId);
  writeHighlightIds(ids);
}

export function consumeBoardGeneratedSessionHighlight(sessionId: string): boolean {
  const ids = readHighlightIds();
  if (!ids.has(sessionId)) return false;
  ids.delete(sessionId);
  writeHighlightIds(ids);
  return true;
}
