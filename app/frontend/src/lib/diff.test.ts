import { describe, expect, it } from 'vitest';
import { diffLines, diffStats } from './diff';

describe('diffLines', () => {
  it('detects added and removed lines', () => {
    const d = diffLines('a\nb\nc', 'a\nx\nc\nd');
    expect(d.map((l) => `${l.type}:${l.text}`)).toEqual(['same:a', 'del:b', 'add:x', 'same:c', 'add:d']);
    expect(diffStats(d)).toEqual({ added: 2, removed: 1 });
  });

  it('returns only same lines for identical input', () => {
    expect(diffStats(diffLines('a\nb', 'a\nb'))).toEqual({ added: 0, removed: 0 });
  });
});
