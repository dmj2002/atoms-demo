import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import { javascript as jsLang } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  FileCode2,
  History,
  RotateCcw,
  GitCompare,
  Eye,
  Code2,
  Wrench,
  X,
  Share2,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react';
import VersionDiff from '@/components/builder/VersionDiff';
import { buildPreviewWithErrorHook, PREVIEW_ERROR, type Files, type Version } from '@/lib/project';

export type Tab = 'preview' | 'code' | 'history';

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  files: Files;
  previewSource: Files;
  selected: string | null;
  setSelected: (p: string) => void;
  versions: Version[];
  currentVersion: number | null;
  onRestore: (id: number) => void;
  busy: boolean;
  onFix: (errors: string[]) => void;
  onEdit: (path: string, content: string) => void;
  onShare?: () => void;
  sharing?: boolean;
  onErrorsChange?: (errors: string[]) => void;
}

const TABS: { id: Tab; label: string; icon: typeof Eye }[] = [
  { id: 'preview', label: '预览', icon: Eye },
  { id: 'code', label: '代码', icon: Code2 },
  { id: 'history', label: '版本', icon: History },
];

const DEVICES = { desktop: '100%', tablet: '768px', mobile: '390px' } as const;
const DEVICE_ICONS = [
  { id: 'desktop', icon: Monitor, label: '桌面尺寸' },
  { id: 'tablet', icon: Tablet, label: '平板尺寸' },
  { id: 'mobile', icon: Smartphone, label: '手机尺寸' },
] as const;

function languageFor(path: string) {
  if (path.endsWith('.css')) return [cssLang()];
  if (/\.(m?js|jsx|ts|tsx)$/.test(path)) return [jsLang({ jsx: true, typescript: path.endsWith('ts') || path.endsWith('tsx') })];
  if (path.endsWith('.html')) return [htmlLang()];
  return [];
}

export default function Workspace(p: Props) {
  const { tab, setTab, files, previewSource, selected, setSelected, versions, currentVersion, busy } = p;
  const paths = Object.keys(files).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
  const current = selected && files[selected] !== undefined ? selected : paths[0];
  const srcDoc = useMemo(() => buildPreviewWithErrorHook(previewSource), [previewSource]);
  const extensions = useMemo(() => languageFor(current ?? ''), [current]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<keyof typeof DEVICES>('desktop');
  const [errors, setErrors] = useState<string[]>([]);
  const [compare, setCompare] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => setErrors([]), [srcDoc]);
  const reportErrors = p.onErrorsChange;
  useEffect(() => reportErrors?.(errors), [errors, reportErrors]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow || e.data?.type !== PREVIEW_ERROR) return;
      setErrors((prev) => (prev.includes(e.data.message) || prev.length >= 10 ? prev : [...prev, e.data.message]));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors duration-150 ${
              tab === id ? 'bg-[#C6F432] text-[#111214]' : 'text-[#8B8D93] hover:bg-[#1F2024] hover:text-[#ECECEC]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        {tab === 'preview' && (
          <div className="ml-auto flex gap-1">
            {DEVICE_ICONS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                aria-label={label}
                title={label}
                onClick={() => setDevice(id)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  device === id ? 'bg-[#1F2024] text-[#C6F432]' : 'text-[#8B8D93] hover:text-[#ECECEC]'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        )}
        <button
          onClick={p.onShare}
          disabled={!p.onShare || p.sharing}
          title={p.onShare ? '生成公开分享链接' : '登录并生成应用后可分享'}
          className={`${tab === 'preview' ? '' : 'ml-auto'} flex h-9 items-center gap-1.5 rounded-lg bg-[#C6F432] px-3 text-sm font-medium text-[#111214] disabled:opacity-40`}
        >
          <Share2 className="h-4 w-4" />
          {p.sharing ? '分享中…' : '分享链接'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[14px] bg-[#F4F1EA] shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        {tab === 'preview' &&
          (Object.keys(previewSource).length ? (
            <div className="relative h-full bg-[#E8E4DA]">
              {busy && (
                <div className="absolute right-3 top-3 z-10 rounded-lg bg-[#111214]/85 px-3 py-1.5 font-mono text-xs text-[#C6F432]">
                  Alex 编写中，文件完成即刷新…
                </div>
              )}
              {!busy && errors.length > 0 && (
                <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl border border-[#FF5C5C] bg-[#17181B] p-3 text-[#ECECEC] shadow-lg">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#FF5C5C]">
                    检测到 {errors.length} 个运行错误
                    <button aria-label="忽略错误" onClick={() => setErrors([])} className="ml-auto text-[#8B8D93] hover:text-[#ECECEC]">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <pre className="mb-3 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-xs text-[#8B8D93]">{errors.join('\n')}</pre>
                  <button
                    onClick={() => {
                      p.onFix(errors);
                      setErrors([]);
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-[#C6F432] px-3 text-sm font-medium text-[#111214]"
                  >
                    <Wrench className="h-4 w-4" />
                    让 Alex 修复
                  </button>
                </div>
              )}
              <iframe
                ref={frameRef}
                title="应用预览"
                srcDoc={srcDoc}
                sandbox="allow-scripts allow-modals allow-forms allow-popups"
                className="mx-auto block h-full bg-white transition-[width] duration-150"
                style={{ width: DEVICES[device] }}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-sm text-[#5c5a55]">
              {busy ? 'Alex 正在编写代码，可切到「代码」查看实时输出…' : '生成的应用将在这里展示'}
            </div>
          ))}

        {tab === 'code' && (
          <div className="flex h-full bg-[#1F2024] text-[#ECECEC]">
            <div className="w-[180px] shrink-0 overflow-y-auto border-r border-[#2A2C31] p-2">
              <div className="mb-2 px-2 text-xs uppercase tracking-wide text-[#8B8D93]">文件</div>
              {paths.length === 0 && <div className="px-2 text-xs text-[#8B8D93]">暂无文件</div>}
              {paths.map((path) => (
                <button
                  key={path}
                  onClick={() => setSelected(path)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs ${
                    path === current ? 'bg-[#2A2C31] text-[#C6F432]' : 'hover:bg-[#2A2C31]'
                  }`}
                >
                  <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{path}</span>
                </button>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="border-b border-[#2A2C31] px-4 py-1.5 font-mono text-xs text-[#8B8D93]">
                {busy ? '生成中，完成后可编辑' : current ? `✎ ${current} · 可直接编辑，预览自动更新` : ''}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden text-[12.5px]">
                {current ? (
                  <CodeMirror
                    value={files[current]}
                    height="100%"
                    style={{ height: '100%' }}
                    theme={oneDark}
                    extensions={extensions}
                    editable={!busy}
                    readOnly={busy}
                    basicSetup={{ tabSize: 2 }}
                    onChange={(v) => {
                      if (!busy) p.onEdit(current, v);
                    }}
                  />
                ) : (
                  <div className="p-4 text-xs text-[#8B8D93]">生成应用后可在这里查看与编辑代码</div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && compare && (
          <VersionDiff versions={versions} initialFrom={compare.from} initialTo={compare.to} onClose={() => setCompare(null)} />
        )}
        {tab === 'history' && !compare && (
          <div className="h-full overflow-y-auto bg-[#1F2024] p-4 text-[#ECECEC]">
            {versions.length === 0 && <div className="text-sm text-[#8B8D93]">暂无版本</div>}
            <div className="space-y-2">
              {[...versions].reverse().map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-xl border border-[#2A2C31] bg-[#17181B] p-3">
                  <div className="font-mono text-sm text-[#C6F432]">v{v.id}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{v.prompt}</div>
                    <div className="text-xs text-[#8B8D93]">
                      {new Date(v.createdAt).toLocaleString()} · {Object.keys(v.files).length} 个文件
                    </div>
                  </div>
                  {versions.length > 1 && (
                    <button
                      onClick={() => {
                        const idx = versions.findIndex((x) => x.id === v.id);
                        const prev = versions[idx - 1] ?? versions[idx + 1];
                        setCompare(idx > 0 ? { from: prev.id, to: v.id } : { from: v.id, to: prev.id });
                      }}
                      className="flex h-9 items-center gap-1 rounded-lg border border-[#2A2C31] px-3 text-xs hover:border-[#C6F432]"
                    >
                      <GitCompare className="h-3.5 w-3.5" />
                      对比
                    </button>
                  )}
                  {v.id === currentVersion ? (
                    <span className="text-xs text-[#C6F432]">当前</span>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => p.onRestore(v.id)}
                      className="flex h-9 items-center gap-1 rounded-lg border border-[#2A2C31] px-3 text-xs hover:border-[#C6F432] disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      回退
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
