import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, GitFork, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { apiError, deleteShare, listGallery, listMyShares, remixShare, updateShare, type ShareItem } from '@/lib/backend';
import type { Files } from '@/lib/project';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTab: 'mine' | 'gallery';
  loggedIn: boolean;
  onRemix: (title: string, files: Files) => void;
}

const linkOf = (id: number) => `${window.location.origin}/share/${id}`;

export default function SharesDialog({ open, onOpenChange, initialTab, loggedIn, onRemix }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [items, setItems] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (t: 'mine' | 'gallery') => {
    setLoading(true);
    setError('');
    try {
      setItems(t === 'mine' ? await listMyShares() : await listGallery());
    } catch (e) {
      setError(apiError(e, '加载失败'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);
  useEffect(() => {
    if (open) load(tab);
  }, [open, tab, load]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      toast.success(okMsg);
      load(tab);
    } catch (e) {
      toast.error(apiError(e, '操作失败'));
    }
  };

  const remix = async (id: number) => {
    if (!loggedIn) return toast.error('请先登录再基于作品继续修改');
    try {
      const r = await remixShare(id);
      onRemix(r.title, r.files);
      onOpenChange(false);
      toast.success('已复制到新会话，可继续对话修改');
    } catch (e) {
      toast.error(apiError(e, '复制失败'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden border-[#2A2C31] bg-[#17181B] text-[#ECECEC]">
        <DialogHeader>
          <DialogTitle>分享与作品广场</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1">
          {(['mine', 'gallery'] as const).map((t) => (
            <button
              key={t}
              disabled={t === 'mine' && !loggedIn}
              onClick={() => setTab(t)}
              className={`h-9 rounded-lg px-3 text-sm disabled:opacity-40 ${tab === t ? 'bg-[#C6F432] text-[#111214]' : 'text-[#8B8D93] hover:bg-[#1F2024]'}`}
            >
              {t === 'mine' ? '我的分享' : '作品广场'}
            </button>
          ))}
        </div>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {loading && <div className="py-8 text-center text-sm text-[#8B8D93]">加载中…</div>}
          {!loading && error && <div className="py-8 text-center text-sm text-[#FF5C5C]">{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className="py-8 text-center text-sm text-[#8B8D93]">
              {tab === 'mine' ? '还没有分享，在工作区点击“分享链接”即可创建' : '广场暂无公开作品'}
            </div>
          )}
          {!loading &&
            items.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[#2A2C31] bg-[#1F2024] p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="text-xs text-[#8B8D93]">
                    #{s.id} · {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''} · 被复用 {s.remix_count} 次
                  </div>
                </div>
                {tab === 'mine' && (
                  <label className="flex items-center gap-1.5 text-xs text-[#8B8D93]">
                    公开到广场
                    <Switch
                      checked={s.is_public}
                      onCheckedChange={(v) => act(() => updateShare(s.id, { is_public: v }), v ? '已公开到作品广场' : '已从广场撤下')}
                    />
                  </label>
                )}
                <a
                  href={linkOf(s.id)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="打开作品"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8B8D93] hover:text-[#ECECEC]"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {tab === 'mine' ? (
                  <>
                    <button
                      aria-label="复制链接"
                      onClick={() => navigator.clipboard.writeText(linkOf(s.id)).then(() => toast.success('链接已复制'))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8B8D93] hover:text-[#ECECEC]"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="撤回分享"
                      onClick={() => confirm(`撤回「${s.title}」？链接将失效`) && act(() => deleteShare(s.id), '已撤回分享')}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8B8D93] hover:text-[#FF5C5C]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => remix(s.id)}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-[#2A2C31] px-3 text-xs hover:border-[#C6F432]"
                  >
                    <GitFork className="h-3.5 w-3.5" />
                    基于此修改
                  </button>
                )}
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
