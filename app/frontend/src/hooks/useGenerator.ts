import { useCallback, useRef, useState } from 'react';
import { streamChat, type Settings } from '@/lib/llm';
import { applyPatches, SYSTEM_PROMPT, buildUserPrompt, parseOutput, type Files, type Message, type Version } from '@/lib/project';
import { uid } from '@/lib/storage';
import type { UpdateSession } from '@/hooks/useSessions';

/** Runs one agent generation round and writes progress into the given session. */
export function useGenerator(settings: Settings, updateSession: UpdateSession) {
  const [busy, setBusy] = useState(false);
  const [liveFiles, setLiveFiles] = useState<Files | null>(null);
  const [previewFiles, setPreviewFiles] = useState<Files | null>(null);
  const [writing, setWriting] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (sessionId: string, base: Files, text: string, images: string[] = []): Promise<boolean> => {
      const emmaId = uid();
      const alexId = uid();
      const patchMsg = (id: string, patch: Partial<Message>) =>
        updateSession(sessionId, (s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

      updateSession(sessionId, (s) => ({
        title: s.messages.length ? s.title : text.slice(0, 24),
        messages: [
          ...s.messages,
          { id: uid(), role: 'user', content: text, images },
          { id: emmaId, role: 'agent', agent: 'Emma', content: '', status: 'working' },
          { id: alexId, role: 'agent', agent: 'Alex', content: '等待模型响应…', status: 'working' },
        ],
      }));
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const started = Date.now();
      const elapsed = () => Math.round((Date.now() - started) / 1000);
      let acc = '';
      let lastClosed = 0;
      let firstToken = false;
      const ticker = setInterval(() => {
        if (!firstToken) patchMsg(alexId, { content: `等待模型响应… 已用 ${elapsed()}s` });
      }, 1000);

      try {
        await streamChat(
          settings,
          SYSTEM_PROMPT,
          [{ role: 'user', content: buildUserPrompt(text, base, images.length), images }],
          (d) => {
            acc += d;
            firstToken = true;
            const { plan, files: out, patches, writing: w } = parseOutput(acc);
            const names = [...new Set([...Object.keys(out), ...patches.map((p) => p.path), ...(w ? [w] : [])])];
            patchMsg(emmaId, { content: plan, status: names.length ? 'done' : 'working' });
            if (!names.length) {
              patchMsg(alexId, { content: '等待 Emma 完成需求分析…' });
              return;
            }
            setLiveFiles(applyPatches({ ...base, ...out }, patches).files);
            setWriting(w);
            const closed = names.filter((n) => n !== w);
            if (closed.length > lastClosed) {
              lastClosed = closed.length;
              const done = Object.fromEntries(Object.keys(out).filter((n) => n !== w).map((n) => [n, out[n]]));
              setPreviewFiles(applyPatches({ ...base, ...done }, patches).files);
            }
            patchMsg(alexId, {
              content: `正在编写代码：\n${names.map((n) => `${n === w ? '✎' : '✓'} ${n}`).join('\n')}`,
            });
          },
          ctrl.signal,
        );

        const { plan, files: out, patches, summary } = parseOutput(acc);
        const applied = applyPatches({ ...base, ...out }, patches);
        const changed = [...new Set([...Object.keys(out), ...patches.map((p) => p.path)])];
        const patchNote = patches.length ? ` · ${patches.length} 处增量修改` : '';
        const failNote = applied.failed.length
          ? `\n⚠ ${applied.failed.length} 处补丁未匹配到原代码（${[...new Set(applied.failed)].join(', ')}），已跳过`
          : '';
        if (!changed.length) throw new Error('模型未返回任何文件，请重试或更换模型。\n' + acc.slice(0, 300));
        const secs = elapsed();
        updateSession(sessionId, (s) => {
          const id = (s.versions.at(-1)?.id ?? 0) + 1;
          const version: Version = { id, prompt: text, files: applied.files, createdAt: Date.now() };
          return {
            versions: [...s.versions, version],
            current: id,
            messages: s.messages.map((m) =>
              m.id === emmaId
                ? { ...m, content: plan || '需求已明确，交由 Alex 实现。', status: 'done' }
                : m.id === alexId
                  ? {
                      ...m,
                      status: 'done',
                      versionId: id,
                      content: `${summary || '应用已生成。'}\n\n📦 v${id} · ${changed.join(', ')}${patchNote} · 用时 ${secs}s${failNote}`,
                    }
                  : m,
            ),
          };
        });
        return true;
      } catch (e) {
        const msg = ctrl.signal.aborted ? '已停止生成' : (e as Error).message;
        patchMsg(emmaId, { status: 'done' });
        patchMsg(alexId, { status: 'error', content: msg });
        return false;
      } finally {
        clearInterval(ticker);
        setLiveFiles(null);
        setPreviewFiles(null);
        setWriting(null);
        setBusy(false);
      }
    },
    [settings, updateSession],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { busy, liveFiles, previewFiles, writing, generate, stop };
}
