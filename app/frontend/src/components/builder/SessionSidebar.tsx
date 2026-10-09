import { useState } from 'react';
import { Pencil, Plus, Search, Trash2, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Session } from '@/lib/storage';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessions: Session[];
  activeId: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function timeLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString();
}

export default function SessionSidebar(p: Props) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const list = [...p.sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()));

  const commit = (id: string) => {
    p.onRename(id, draft);
    setEditing(null);
  };

  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange}>
      <SheetContent side="left" className="flex w-[320px] flex-col gap-3 border-[#2A2C31] bg-[#17181B] p-4 text-[#ECECEC]">
        <SheetHeader>
          <SheetTitle className="text-[#ECECEC]">会话</SheetTitle>
        </SheetHeader>
        <button
          disabled={p.busy}
          onClick={() => {
            p.onCreate();
            p.onOpenChange(false);
          }}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#C6F432] text-sm font-medium text-[#111214] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          新建会话
        </button>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-[#2A2C31] bg-[#1F2024] px-2 focus-within:border-[#C6F432]">
          <Search className="h-4 w-4 text-[#8B8D93]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索会话"
            aria-label="搜索会话"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#8B8D93]"
          />
        </label>
        <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {list.length === 0 && <div className="py-6 text-center text-xs text-[#8B8D93]">没有匹配的会话</div>}
          {list.map((s) => {
            const active = s.id === p.activeId;
            return (
              <div
                key={s.id}
                className={`group flex items-center gap-1 rounded-lg border px-2 py-2 ${
                  active ? 'border-[#C6F432] bg-[#1F2024]' : 'border-transparent hover:bg-[#1F2024]'
                }`}
              >
                {editing === s.id ? (
                  <>
                    <input
                      autoFocus
                      value={draft}
                      aria-label="会话名称"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commit(s.id);
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      className="min-w-0 flex-1 rounded border border-[#2A2C31] bg-[#111214] px-2 py-1 text-sm outline-none focus:border-[#C6F432]"
                    />
                    <button aria-label="保存名称" onClick={() => commit(s.id)} className="flex h-8 w-8 items-center justify-center text-[#C6F432]">
                      <Check className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={p.busy && !active}
                      onClick={() => {
                        p.onSelect(s.id);
                        p.onOpenChange(false);
                      }}
                      className="min-w-0 flex-1 text-left disabled:opacity-40"
                    >
                      <div className="truncate text-sm">{s.title}</div>
                      <div className="text-xs text-[#8B8D93]">
                        {timeLabel(s.updatedAt)} · {s.versions.length} 个版本
                      </div>
                    </button>
                    <button
                      aria-label="重命名会话"
                      onClick={() => {
                        setEditing(s.id);
                        setDraft(s.title);
                      }}
                      className="flex h-8 w-8 items-center justify-center text-[#8B8D93] opacity-60 hover:text-[#ECECEC] group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label="删除会话"
                      disabled={p.busy}
                      onClick={() => {
                        if (confirm(`删除会话「${s.title}」？`)) p.onDelete(s.id);
                      }}
                      className="flex h-8 w-8 items-center justify-center text-[#8B8D93] opacity-60 hover:text-[#FF5C5C] group-hover:opacity-100 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
