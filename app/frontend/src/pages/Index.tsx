import { useRef, useState } from 'react';
import { toast } from 'sonner';
import AppHeader from '@/components/builder/AppHeader';
import ChatPanel from '@/components/builder/ChatPanel';
import SessionSidebar from '@/components/builder/SessionSidebar';
import SettingsDialog from '@/components/builder/SettingsDialog';
import SharesDialog from '@/components/builder/SharesDialog';
import Workspace, { type Tab } from '@/components/builder/Workspace';
import { client, useAuth } from '@/components/builder/AuthButton';
import { useGenerator } from '@/hooks/useGenerator';
import { useSessions } from '@/hooks/useSessions';
import { useUserSettings } from '@/hooks/useUserSettings';
import { apiError, publishShare } from '@/lib/backend';
import { useCloudSync } from '@/lib/cloudSync';
import { PROVIDERS } from '@/lib/llm';
import { exportHtml, exportZip, type Files, type Message } from '@/lib/project';
import { uid } from '@/lib/storage';

const MAX_AUTO_FIX = 2;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fixPrompt = (errs: string[]) =>
  `预览运行时出现以下错误，请定位原因并修复，保持其他功能不变：\n${errs.map((x, i) => `${i + 1}. ${x}`).join('\n')}`;

export default function Index() {
  const { state: auth, user } = useAuth();
  const userKey = user?.id ?? 'guest';
  const { settings, save: saveSettings, keyReady } = useUserSettings(userKey);
  const sessions = useSessions(userKey);
  const { all, store, currentFiles, updateSession } = sessions;
  const syncStatus = useCloudSync(auth === 'authenticated' && !!user, all, sessions.setAll);
  const gen = useGenerator(settings, updateSession);

  const [tab, setTab] = useState<Tab>('preview');
  const [selected, setSelected] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'chat' | 'work'>('chat');
  const [sharing, setSharing] = useState(false);
  const [sharesTab, setSharesTab] = useState<'mine' | 'gallery' | null>(null);

  const hasFiles = Object.keys(currentFiles).length > 0;
  const files = gen.liveFiles ?? currentFiles;

  const allRef = useRef(all);
  allRef.current = all;
  const errorsRef = useRef<string[]>([]);
  const [checking, setChecking] = useState(false);

  const filesOf = (sid: string): Files => {
    const s = allRef.current.sessions.find((x) => x.id === sid);
    return s?.versions.find((v) => v.id === s.current)?.files ?? {};
  };

  /** One user request: generate, then let Quinn run the preview and auto-fix runtime errors. */
  const runRound = async (text: string, images: string[]) => {
    const sid = store.id;
    let ok = await gen.generate(sid, filesOf(sid), text, images);
    if (!ok || settings.autoFix === false) return;
    setChecking(true);
    try {
      for (let attempt = 1; ok; attempt++) {
        const qid = uid();
        const quinn = (patch: Partial<Message>) =>
          updateSession(sid, (s) => ({ messages: s.messages.map((m) => (m.id === qid ? { ...m, ...patch } : m)) }));
        updateSession(sid, (s) => ({
          messages: [...s.messages, { id: qid, role: 'agent', agent: 'Quinn', content: '正在预览中运行应用，检查报错…', status: 'working' }],
        }));
        setTab('preview');
        await wait(3500);
        const errs = [...errorsRef.current];
        if (!errs.length) {
          quinn({ status: 'done', content: '✓ 运行检查通过，未发现报错' });
          break;
        }
        if (attempt > MAX_AUTO_FIX) {
          quinn({
            status: 'error',
            content: `仍有 ${errs.length} 个报错，已达自动修复上限（${MAX_AUTO_FIX} 次），可在预览中点击“让 Alex 修复”。\n${errs.join('\n')}`,
          });
          break;
        }
        quinn({ status: 'done', content: `发现 ${errs.length} 个运行错误，交给 Alex 自动修复（第 ${attempt}/${MAX_AUTO_FIX} 次）：\n${errs.join('\n')}` });
        ok = await gen.generate(sid, filesOf(sid), fixPrompt(errs), []);
      }
    } finally {
      setChecking(false);
    }
  };

  const send = async (text: string, images: string[] = []) => {
    if (gen.busy || checking) return;
    if (auth !== 'authenticated') {
      if (auth === 'anonymous') client.auth.toLogin();
      return;
    }
    if (!keyReady) {
      setSettingsOpen(true);
      return;
    }
    setTab('preview');
    setMobileView('work');
    await runRound(text, images);
  };

  const share = async () => {
    setSharing(true);
    try {
      const isPublic = confirm('是否同时公开到作品广场？\n确定：公开到广场；取消：仅通过链接访问');
      const link = await publishShare(store.title, currentFiles, isPublic);
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success('分享链接已复制', { description: link, duration: 10000 });
    } catch (e) {
      toast.error(apiError(e, '分享失败'));
    } finally {
      setSharing(false);
    }
  };

  const editFile = (path: string, content: string) =>
    updateSession(store.id, (s) => ({
      versions: s.versions.map((v) => (v.id === s.current ? { ...v, files: { ...v.files, [path]: content } } : v)),
    }));

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#111214] font-['Space_Grotesk',sans-serif] text-[#ECECEC]">
      <AppHeader
        auth={auth}
        syncStatus={syncStatus}
        modelLabel={`${PROVIDERS[settings.provider].label} · ${settings.model}`}
        sessionTitle={store.title}
        busy={gen.busy}
        hasFiles={hasFiles}
        onOpenSessions={() => setSessionsOpen(true)}
        onNewSession={sessions.create}
        onExportHtml={() => exportHtml(currentFiles)}
        onExportZip={() => exportZip(currentFiles)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShares={setSharesTab}
      />

      <div className="flex border-b border-[#2A2C31] md:hidden">
        {(['chat', 'work'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setMobileView(v)}
            className={`h-10 flex-1 text-sm ${mobileView === v ? 'border-b-2 border-[#C6F432] text-[#ECECEC]' : 'text-[#8B8D93]'}`}
          >
            {v === 'chat' ? '对话' : '工作区'}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={`${mobileView === 'chat' ? 'flex' : 'hidden'} w-full flex-col border-r border-[#2A2C31] md:flex md:w-[320px] md:shrink-0 lg:w-[380px]`}
        >
          <ChatPanel messages={store.messages} busy={gen.busy || checking} onSend={send} onStop={gen.stop} auth={auth} />
        </div>
        <div className={`${mobileView === 'work' ? 'block' : 'hidden'} min-w-0 flex-1 md:block`}>
          <Workspace
            tab={tab}
            setTab={setTab}
            files={files}
            previewSource={gen.previewFiles ?? currentFiles}
            selected={gen.busy && gen.writing ? gen.writing : selected}
            setSelected={setSelected}
            versions={store.versions}
            currentVersion={store.current}
            onRestore={(id) => {
              updateSession(store.id, () => ({ current: id }));
              setTab('preview');
            }}
            busy={gen.busy}
            onEdit={editFile}
            onShare={auth === 'authenticated' && hasFiles && !gen.busy ? share : undefined}
            sharing={sharing}
            onFix={(errs) => send(fixPrompt(errs))}
            onErrorsChange={(errs) => {
              errorsRef.current = errs;
            }}
          />
        </div>
      </div>

      {!keyReady && (
        <button
          onClick={() => setSettingsOpen(true)}
          className="fixed bottom-24 right-6 rounded-lg bg-[#C6F432] px-4 py-2 text-sm font-medium text-[#111214] shadow-lg"
        >
          配置 API Key 开始使用
        </button>
      )}

      <SessionSidebar
        open={sessionsOpen}
        onOpenChange={setSessionsOpen}
        sessions={all.sessions}
        activeId={all.activeId}
        busy={gen.busy}
        onSelect={sessions.select}
        onCreate={sessions.create}
        onRename={sessions.rename}
        onDelete={sessions.remove}
      />
      <SharesDialog
        open={sharesTab !== null}
        onOpenChange={(o) => !o && setSharesTab(null)}
        initialTab={sharesTab ?? 'gallery'}
        loggedIn={auth === 'authenticated'}
        onRemix={(title, files) => {
          sessions.importProject(title, files);
          setTab('preview');
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={saveSettings}
        canUseServer={auth === 'authenticated'}
      />
    </div>
  );
}
