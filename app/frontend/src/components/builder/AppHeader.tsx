import { Settings2, Plus, FileDown, Archive, Cloud, MoreHorizontal, PanelLeft, LayoutGrid, Link2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AuthButton, { type AuthState } from '@/components/builder/AuthButton';
import type { SyncStatus } from '@/lib/cloudSync';

interface Props {
  auth: AuthState;
  syncStatus: SyncStatus;
  modelLabel: string;
  sessionTitle: string;
  busy: boolean;
  hasFiles: boolean;
  onOpenSessions: () => void;
  onNewSession: () => void;
  onExportHtml: () => void;
  onExportZip: () => void;
  onOpenSettings: () => void;
  onOpenShares: (tab: 'mine' | 'gallery') => void;
}

const SYNC_TEXT: Record<SyncStatus, string> = {
  off: '',
  syncing: '同步中…',
  synced: '已同步到云端',
  error: '云端同步失败，数据仍保存在本地',
};

const iconBtn =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2C31] transition-colors duration-150 hover:border-[#C6F432]';

export default function AppHeader(p: Props) {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-[#2A2C31] px-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C6F432] font-semibold text-[#111214]">A</span>
      <span className="hidden shrink-0 font-semibold sm:inline">Atoms Demo</span>
      <button
        onClick={p.onOpenSessions}
        aria-label="打开会话列表"
        className="ml-2 flex h-9 min-w-0 items-center gap-2 rounded-lg border border-[#2A2C31] px-3 text-sm hover:border-[#C6F432]"
      >
        <PanelLeft className="h-4 w-4 shrink-0" />
        <span className="max-w-[160px] truncate">{p.sessionTitle}</span>
      </button>
      <span className="ml-2 hidden truncate font-mono text-xs text-[#8B8D93] xl:inline">{p.modelLabel}</span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {p.auth === 'authenticated' && (
          <span
            title={SYNC_TEXT[p.syncStatus]}
            aria-label={SYNC_TEXT[p.syncStatus]}
            className={`hidden h-9 items-center sm:flex ${
              p.syncStatus === 'error' ? 'text-[#FF5C5C]' : p.syncStatus === 'synced' ? 'text-[#C6F432]' : 'text-[#8B8D93]'
            }`}
          >
            <Cloud className={`h-4 w-4 ${p.syncStatus === 'syncing' ? 'animate-pulse' : ''}`} />
          </span>
        )}
        <button className={iconBtn} onClick={p.onOpenSettings} aria-label="模型设置" title="模型设置">
          <Settings2 className="h-4 w-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={iconBtn} aria-label="更多操作" title="更多操作">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={p.busy} onClick={p.onNewSession}>
              <Plus className="mr-2 h-4 w-4" />
              新建会话
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.onOpenShares('gallery')}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              作品广场
            </DropdownMenuItem>
            <DropdownMenuItem disabled={p.auth !== 'authenticated'} onClick={() => p.onOpenShares('mine')}>
              <Link2 className="mr-2 h-4 w-4" />
              我的分享
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!p.hasFiles || p.busy} onClick={p.onExportHtml}>
              <FileDown className="mr-2 h-4 w-4" />
              导出单个 HTML
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!p.hasFiles || p.busy} onClick={p.onExportZip}>
              <Archive className="mr-2 h-4 w-4" />
              导出 ZIP
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AuthButton state={p.auth} />
      </div>
    </header>
  );
}
