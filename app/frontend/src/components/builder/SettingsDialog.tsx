import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROVIDERS, type Provider, type Settings } from '@/lib/llm';
import { apiError, deleteServerKey, listServerKeys, saveServerKey } from '@/lib/backend';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: Settings;
  onSave: (s: Settings) => void;
  canUseServer: boolean;
}

const STORAGE_OPTIONS = [
  { id: 'local', title: '仅保存在本浏览器', desc: '浏览器直连模型，逐字输出最流畅' },
  { id: 'server', title: '加密保存到服务器', desc: '浏览器不保存密钥，经后端转发，可能整段返回' },
] as const;

const FIELDS = [
  { key: 'baseUrl', label: 'Base URL' },
  { key: 'model', label: '代码模型' },
  { key: 'visionModel', label: '识图模型（上传参考图时使用）' },
] as const;

export default function SettingsDialog({ open, onOpenChange, settings, onSave, canUseServer }: Props) {
  const [draft, setDraft] = useState(settings);
  const [serverProviders, setServerProviders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
    setError('');
    if (canUseServer) listServerKeys().then(setServerProviders).catch(() => setServerProviders([]));
  }, [open, settings, canUseServer]);

  const storage = draft.keyStorage ?? 'local';
  const hasServerKey = serverProviders.includes(draft.provider);

  const submit = async () => {
    setError('');
    if (storage === 'local') {
      onSave({ ...draft, keyStorage: 'local', serverKeyReady: false });
      onOpenChange(false);
      return;
    }
    if (!canUseServer) return setError('请先登录，再把密钥保存到服务器');
    const key = draft.apiKey.trim();
    if (!key && !hasServerKey) return setError('请填写 API Key');
    setSaving(true);
    try {
      if (key) await saveServerKey(draft.provider, key);
      onSave({ ...draft, apiKey: '', keyStorage: 'server', serverKeyReady: true });
      onOpenChange(false);
    } catch (e) {
      setError(apiError(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const removeServerKey = async () => {
    try {
      await deleteServerKey(draft.provider);
      setServerProviders((list) => list.filter((p) => p !== draft.provider));
      if (settings.provider === draft.provider && settings.keyStorage === 'server') onSave({ ...settings, serverKeyReady: false });
    } catch (e) {
      setError(apiError(e, '删除失败'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#2A2C31] bg-[#17181B] text-[#ECECEC]">
        <DialogHeader>
          <DialogTitle>模型设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>服务商</Label>
            <Select
              value={draft.provider}
              onValueChange={(v) => {
                const p = v as Provider;
                setDraft((d) => ({ ...d, provider: p, baseUrl: PROVIDERS[p].baseUrl, model: PROVIDERS[p].model, visionModel: PROVIDERS[p].visionModel }));
              }}
            >
              <SelectTrigger className="border-[#2A2C31] bg-[#1F2024]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PROVIDERS[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>密钥保存方式</Label>
            <div className="grid grid-cols-2 gap-2">
              {STORAGE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, keyStorage: o.id }))}
                  className={`rounded-lg border p-2.5 text-left transition-colors duration-150 ${
                    storage === o.id ? 'border-[#C6F432] bg-[#1F2024]' : 'border-[#2A2C31] hover:border-[#8B8D93]'
                  }`}
                >
                  <div className="text-sm font-medium">{o.title}</div>
                  <div className="mt-0.5 text-xs text-[#8B8D93]">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={draft.apiKey}
              placeholder={storage === 'server' ? (hasServerKey ? '已加密保存在服务器，留空则不修改' : '输入后将加密保存到服务器') : ''}
              onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
              className="border-[#2A2C31] bg-[#1F2024] font-mono text-xs"
            />
            {storage === 'server' && hasServerKey && (
              <div className="flex items-center justify-between text-xs text-[#C6F432]">
                ✓ 服务器上已保存该服务商的密钥
                <button type="button" onClick={removeServerKey} className="text-[#FF5C5C] hover:underline">
                  从服务器删除
                </button>
              </div>
            )}
          </div>

          {FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={draft[key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="border-[#2A2C31] bg-[#1F2024] font-mono text-xs"
              />
            </div>
          ))}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2A2C31] p-2.5">
            <span>
              <span className="block text-sm">生成后自动检查并修复</span>
              <span className="block text-xs text-[#8B8D93]">测试工程师 Quinn 在预览中运行应用，发现报错自动交给 Alex 修复（最多 2 次）</span>
            </span>
            <Switch checked={draft.autoFix !== false} onCheckedChange={(v) => setDraft((d) => ({ ...d, autoFix: v }))} />
          </label>
          {error && <p className="text-xs text-[#FF5C5C]">{error}</p>}
        </div>
        <DialogFooter>
          <Button disabled={saving} className="bg-[#C6F432] text-[#111214] hover:bg-[#b5e021]" onClick={submit}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
