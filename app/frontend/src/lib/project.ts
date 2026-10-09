import JSZip from 'jszip';

export type Files = Record<string, string>;

export interface Version {
  id: number;
  prompt: string;
  files: Files;
  createdAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'agent';
  agent?: 'Emma' | 'Alex' | 'Quinn';
  content: string;
  status?: 'working' | 'done' | 'error';
  versionId?: number;
  images?: string[];
}

export const SYSTEM_PROMPT = `你是 Atoms 智能体团队，由产品经理 Emma 和工程师 Alex 组成，负责生成可直接在浏览器运行的纯前端 Web 应用（HTML/CSS/原生 JavaScript，不使用构建工具，可通过 CDN 引入库）。
输出必须严格遵循以下格式：
1. 先输出 <plan>...</plan>：Emma 用简洁中文分析需求，列出 3-6 条功能要点与设计思路。
2. 再输出若干文件，每个文件格式为 <file path="文件名">完整文件内容</file>，不要使用 markdown 代码块。
   - 必须包含 index.html，并通过 <link rel="stylesheet" href="style.css"> 与 <script src="script.js"></script> 引用样式和脚本，可按需拆分更多 .css/.js 文件。
   - 迭代修改时只输出有改动的部分：小改动优先使用补丁格式（SEARCH 内容必须与现有代码逐字一致，一个 patch 可包含多个块）：
<patch path="文件名">
<<<<<<< SEARCH
原代码片段
=======
新代码片段
>>>>>>> REPLACE
</patch>
   - 改动较大或新增文件时输出完整的 <file>。
3. 最后用一两句中文总结本次完成的内容（Alex 的汇报）。
界面要美观、现代、响应式，功能完整可交互。`;

export function buildUserPrompt(request: string, files: Files, imageCount = 0) {
  const ref = imageCount ? `\n（附带 ${imageCount} 张参考图，请参考其布局、配色与内容还原界面）` : '';
  return buildBase(request, files) + ref;
}

function buildBase(request: string, files: Files) {
  const paths = Object.keys(files);
  if (!paths.length) return `请生成应用：${request}`;
  const ctx = paths.map((p) => `<file path="${p}">${files[p]}</file>`).join('\n');
  return `当前项目文件：\n${ctx}\n\n请基于以上项目进行修改：${request}`;
}

function stripFence(s: string) {
  return s.replace(/^\s*```[\w-]*\n/, '').replace(/\n```\s*$/, '').replace(/^\n/, '');
}

export interface Patch {
  path: string;
  search: string;
  replace: string;
}

/** Applies SEARCH/REPLACE patches; unmatched patches are reported in `failed`. */
export function applyPatches(files: Files, patches: Patch[]) {
  const next = { ...files };
  const failed: string[] = [];
  for (const p of patches) {
    const cur = next[p.path];
    if (cur === undefined || !cur.includes(p.search)) {
      failed.push(p.path);
      continue;
    }
    next[p.path] = cur.replace(p.search, () => p.replace);
  }
  return { files: next, failed };
}

export function parseOutput(text: string) {
  const plan = text.match(/<plan>([\s\S]*?)(<\/plan>|$)/)?.[1]?.trim() ?? '';
  const files: Files = {};
  let writing: string | null = null;
  const re = /<file path="([^"]+)">([\s\S]*?)(<\/file>|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    files[m[1]] = stripFence(m[2]);
    writing = m[3] ? null : m[1];
  }
  const patches: Patch[] = [];
  const pre = /<patch path="([^"]+)">([\s\S]*?)(<\/patch>|$)/g;
  while ((m = pre.exec(text))) {
    if (!m[3]) {
      writing = m[1];
      continue;
    }
    const block = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let b: RegExpExecArray | null;
    while ((b = block.exec(m[2]))) patches.push({ path: m[1], search: b[1], replace: b[2] });
  }
  const fileEnd = text.lastIndexOf('</file>');
  const patchEnd = text.lastIndexOf('</patch>');
  const end = Math.max(fileEnd >= 0 ? fileEnd + 7 : -1, patchEnd >= 0 ? patchEnd + 8 : -1);
  const summary = end >= 0 ? text.slice(end).trim() : '';
  return { plan, files, patches, writing, summary };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildPreview(files: Files) {
  const htmlPath = files['index.html'] !== undefined ? 'index.html' : Object.keys(files).find((p) => p.endsWith('.html'));
  let html = htmlPath ? files[htmlPath] : '<!doctype html><html><head></head><body></body></html>';
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.css')) {
      const re = new RegExp(`<link[^>]*href=["'](?:\\./)?${esc(path)}["'][^>]*>`, 'i');
      const tag = `<style>\n${content}\n</style>`;
      html = re.test(html) ? html.replace(re, () => tag) : html.replace(/<\/head>/i, () => `${tag}</head>`);
    } else if (path.endsWith('.js')) {
      const re = new RegExp(`<script([^>]*)src=["'](?:\\./)?${esc(path)}["']([^>]*)>\\s*</script>`, 'i');
      const safe = content.replace(/<\/script>/gi, '<\\/script>');
      if (re.test(html)) {
        html = html.replace(re, (_m, a: string, b: string) => `<script${a}${b}>\n${safe}\n</script>`);
      } else {
        html = html.replace(/<\/body>/i, () => `<script>\n${safe}\n</script></body>`);
      }
    }
  }
  return html;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportHtml(files: Files) {
  download(new Blob([buildPreview(files)], { type: 'text/html' }), 'atoms-app.html');
}

export async function exportZip(files: Files) {
  const zip = new JSZip();
  Object.entries(files).forEach(([p, c]) => zip.file(p, c));
  download(await zip.generateAsync({ type: 'blob' }), 'atoms-app.zip');
}

export function compressImage(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('无法解析图片'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const PREVIEW_ERROR = 'atoms-preview-error';

const ERROR_HOOK = `<script>(function(){var send=function(m){try{parent.postMessage({type:'${'${PREVIEW_ERROR}'}',message:String(m).slice(0,500)},'*')}catch(e){}};
window.addEventListener('error',function(e){send((e.message||'脚本错误')+(e.lineno?' (行 '+e.lineno+')':''))});
window.addEventListener('unhandledrejection',function(e){send('未处理的 Promise 异常：'+(e.reason&&e.reason.message||e.reason))});
var ce=console.error;console.error=function(){send(Array.prototype.join.call(arguments,' '));ce.apply(console,arguments)};})();</script>`;

/** Preview HTML with a runtime-error reporter injected before any app script runs. */
export function buildPreviewWithErrorHook(files: Files) {
  const html = buildPreview(files);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + ERROR_HOOK);
  return ERROR_HOOK + html;
}
