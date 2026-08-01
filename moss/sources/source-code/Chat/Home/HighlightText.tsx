import styles from './AgentHome.module.css';

export type HighlightSegment = {
  text: string;
  highlighted: boolean;
};

type HighlightCandidate = {
  start: number;
  end: number;
};

export function normalizeHighlightWords(words: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const word of words ?? []) {
    const trimmed = word.trim();
    if (!trimmed) continue;

    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized.sort((a, b) => b.length - a.length || a.localeCompare(b));
}

export function buildHighlightSegments(
  text: string,
  highlightWords: readonly string[] | null | undefined,
): HighlightSegment[] {
  if (!text) return [];

  const words = normalizeHighlightWords(highlightWords);
  if (words.length === 0) return [{ text, highlighted: false }];

  const lowerText = text.toLocaleLowerCase();
  const candidates: HighlightCandidate[] = [];

  for (const word of words) {
    const lowerWord = word.toLocaleLowerCase();
    let searchFrom = 0;

    while (searchFrom < lowerText.length) {
      const start = lowerText.indexOf(lowerWord, searchFrom);
      if (start < 0) break;

      candidates.push({ start, end: start + word.length });
      searchFrom = start + Math.max(word.length, 1);
    }
  }

  const selected = candidates
    .sort((a, b) => {
      const lengthDelta = b.end - b.start - (a.end - a.start);
      return lengthDelta || a.start - b.start;
    })
    .reduce<HighlightCandidate[]>((matches, candidate) => {
      const overlaps = matches.some(
        (match) => candidate.start < match.end && candidate.end > match.start,
      );
      if (!overlaps) matches.push(candidate);
      return matches;
    }, [])
    .sort((a, b) => a.start - b.start);

  if (selected.length === 0) return [{ text, highlighted: false }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const match of selected) {
    if (match.start > cursor) {
      segments.push({ text: text.slice(cursor, match.start), highlighted: false });
    }
    segments.push({ text: text.slice(match.start, match.end), highlighted: true });
    cursor = match.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }

  return segments;
}

type HighlightTextProps = {
  text: string;
  highlightWords?: readonly string[] | null;
  className?: string;
  highlightClassName?: string;
};

export function HighlightText({
  text,
  highlightWords,
  className,
  highlightClassName,
}: HighlightTextProps) {
  const segments = buildHighlightSegments(text, highlightWords);
  const accentClassName = [styles.highlightText, highlightClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <span key={`${segment.text}_${index}`} className={accentClassName}>
            {segment.text}
          </span>
        ) : (
          <span key={`${segment.text}_${index}`}>{segment.text}</span>
        ),
      )}
    </span>
  );
}
