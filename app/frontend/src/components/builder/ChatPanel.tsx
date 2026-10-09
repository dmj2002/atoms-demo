import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square, ImagePlus, X } from 'lucide-react';
import { compressImage } from '@/lib/project';
import type { Message } from '@/lib/project';
import { client, type AuthState } from '@/components/builder/AuthButton';

const EXAMPLES = ['一个带本地存储的待办清单应用', '经典贪吃蛇游戏，支持计分和难度', '科学计算器，支持键盘输入', '番茄钟专注计时器，带统计图'];

const AGENTS = {
  Emma: { color: '#FF8A65', title: '产品经理' },
  Alex: { color: '#4DD0E1', title: '工程师' },
  Quinn: { color: '#B39DDB', title: '测试工程师' },
};

interface Props {
  messages: Message[];
  busy: boolean;
  onSend: (text: string, images: string[]) => void;
  onStop: () => void;
  auth: AuthState;
}

export default function ChatPanel({ messages, busy, onSend, onStop, auth }: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const [images, setImages] = useState<string[]>([]);
  const [imgError, setImgError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | File[]) => {
    setImgError('');
    const picked = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (!picked.length) return;
    try {
      const urls = await Promise.all(picked.slice(0, 4 - images.length).map((f) => compressImage(f)));
      setImages((prev) => [...prev, ...urls].slice(0, 4));
      if (images.length + picked.length > 4) setImgError('最多上传 4 张参考图');
    } catch (e) {
      setImgError((e as Error).message);
    }
  };

  const submit = (t = text) => {
    const content = t.trim() || (images.length ? '请参考图片生成这个页面' : '');
    if (!content || busy) return;
    onSend(content, images);
    setText('');
    setImages([]);
    setImgError('');
  };

  return (
    <div className="flex h-full flex-col bg-[#17181B]">
      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="pt-10">
            <h2 className="text-2xl font-semibold leading-tight">
              描述你的想法，
              <br />
              <span className="text-[#C6F432]">智能体团队</span>为你构建应用。
            </h2>
            <p className="mt-3 text-sm text-[#8B8D93]">Emma 分析需求，Alex 编写多文件代码，右侧实时预览。</p>
            {auth === 'anonymous' && (
              <button
                onClick={() => client.auth.toLogin()}
                className="mt-5 h-10 w-full rounded-lg bg-[#C6F432] text-sm font-medium text-[#111214]"
              >
                登录 / 注册后开始构建
              </button>
            )}
            <div className="mt-6 flex flex-col gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => submit(e)}
                  className="rounded-lg border border-[#2A2C31] bg-[#1F2024] px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:border-[#C6F432]"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-8 rounded-xl bg-[#C6F432] px-3 py-2 text-sm text-[#111214]">
              {m.images?.length ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {m.images.map((u, i) => (
                    <img key={i} src={u} alt={`参考图 ${i + 1}`} className="h-16 w-16 rounded-md object-cover" />
                  ))}
                </div>
              ) : null}
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-[#111214]"
                style={{ background: AGENTS[m.agent!].color }}
              >
                {m.agent![0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2 text-xs text-[#8B8D93]">
                  <span className="font-semibold text-[#ECECEC]">{m.agent}</span>
                  {AGENTS[m.agent!].title}
                  {m.status === 'working' && <span className="h-2 w-2 animate-pulse rounded-full bg-[#C6F432]" />}
                </div>
                <div
                  className={`whitespace-pre-wrap break-words rounded-xl border bg-[#1F2024] px-3 py-2 text-sm ${
                    m.status === 'error' ? 'border-[#FF5C5C] text-[#FF5C5C]' : 'border-[#2A2C31]'
                  }`}
                >
                  {m.content || '已连接模型，等待输出…'}
                </div>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="border-t border-[#2A2C31] p-3">
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((u, i) => (
              <div key={i} className="relative">
                <img src={u} alt={`待发送参考图 ${i + 1}`} className="h-14 w-14 rounded-lg border border-[#2A2C31] object-cover" />
                <button
                  aria-label="移除图片"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF5C5C] text-[#111214]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {imgError && <div className="mb-2 text-xs text-[#FF5C5C]">{imgError}</div>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="flex items-end gap-2 rounded-xl border border-[#2A2C31] bg-[#1F2024] p-2 focus-within:border-[#C6F432]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const fs = Array.from(e.clipboardData.files);
              if (fs.length) {
                e.preventDefault();
                addFiles(fs);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder={messages.length ? '继续描述要修改的内容…' : '我想做一个…'}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[#8B8D93]"
          />
          <button
            aria-label="上传参考图"
            title="上传参考图（也可直接粘贴截图）"
            disabled={busy || images.length >= 4}
            onClick={() => fileRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8B8D93] hover:text-[#C6F432] disabled:opacity-40"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          {busy ? (
            <button aria-label="停止生成" onClick={onStop} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF5C5C] text-[#111214]">
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              aria-label="发送"
              onClick={() => submit()}
              disabled={!text.trim() && !images.length}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C6F432] text-[#111214] disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
