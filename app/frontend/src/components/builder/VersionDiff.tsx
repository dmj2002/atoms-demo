import { useMemo, useState } from 'react';
import { diffLines, diffStats } from '@/lib/diff';
import type { Version } from '@/lib/project';

interface Props {
  versions: Version[];
  initialFrom: number;
  initialTo: number;
  onClose: () => void;
}

export default function VersionDiff({ versions, initialFrom, initialTo, onClose }: Props) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const a = versions.find((v) => v.id === from)?.files ?? {};
  const b = versions.find((v) => v.id === to)?.files ?? {};
  const paths = useMemo(() => [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(), [a, b]);
  const diffs = useMemo(
    () => paths.map((p) => ({ path: p, lines: diffLines(a[p] ?? '', b[p] ?? '') })).filter((d) => diffStats(d.lines).added + diffStats(d.lines).removed > 0),
    [paths, a, b],
  );
  const select = (value: number, set: (n: number) => void, label: string) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => set(Number(e.target.value))}
      className="h-9 rounded-lg border border-[#2A2C31] bg-[#17181B] px-2 text-sm outline-none focus:border-[#C6F432]"
    >
      {versions.map((v) => (
        <option key={v.id} value={v.id}>
          v{v.id} · {v.prompt.slice(0, 16)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex h-full flex-col bg-[#1F2024] text-[#ECECEC]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2A2C31] p-3 text-sm">
        {select(from, setFrom, '对比起始版本')}
        <span className="text-[#8B8D93]">→</span>
        {select(to, setTo, '对比目标版本')}
        <button onClick={onClose} className="ml-auto h-9 rounded-lg border border-[#2A2C31] px-3 text-xs hover:border-[#C6F432]">
          返回版本列表
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
        {diffs.length === 0 && <div className="py-8 text-center text-sm text-[#8B8D93]">两个版本没有差异</div>}
        {diffs.map(({ path, lines }) => {
          const st = diffStats(lines);
          return (
            <div key={path} className="overflow-hidden rounded-lg border border-[#2A2C31]">
              <div className="flex gap-3 bg-[#17181B] px-3 py-2 font-mono text-xs">
                <span>{path}</span>
                <span className="text-[#C6F432]">+{st.added}</span>
                <span className="text-[#FF5C5C]">-{st.removed}</span>
              </div>
              <pre className="overflow-x-auto font-mono text-[12px] leading-[1.6]">
                {lines.map((l, i) =>
                  l.type === 'same' ? null : (
                    <div key={i} className={l.type === 'add' ? 'bg-[#C6F432]/10 text-[#d9f78a]' : 'bg-[#FF5C5C]/10 text-[#ff9b9b]'}>
                      <span className="inline-block w-6 select-none text-center">{l.type === 'add' ? '+' : '-'}</span>
                      {l.text}
                    </div>
                  ),
                )}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
