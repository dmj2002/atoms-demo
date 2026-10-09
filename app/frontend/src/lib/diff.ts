export interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
}

/** Line diff via LCS; falls back to whole-file replace for very large inputs. */
export function diffLines(a: string, b: string): DiffLine[] {
  const x = a.split('\n');
  const y = b.split('\n');
  if (x.length * y.length > 4_000_000) {
    return [...x.map((t) => ({ type: 'del' as const, text: t })), ...y.map((t) => ({ type: 'add' as const, text: t }))];
  }
  const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      out.push({ type: 'same', text: x[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: 'del', text: x[i++] });
    else out.push({ type: 'add', text: y[j++] });
  }
  while (i < x.length) out.push({ type: 'del', text: x[i++] });
  while (j < y.length) out.push({ type: 'add', text: y[j++] });
  return out;
}

export function diffStats(lines: DiffLine[]) {
  return { added: lines.filter((l) => l.type === 'add').length, removed: lines.filter((l) => l.type === 'del').length };
}
