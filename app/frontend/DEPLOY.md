# Atoms Demo

由智能体驱动的应用生成器：用户描述需求（可附参考图），产品经理 Emma 分析需求，工程师 Alex 流式编写多文件代码，测试工程师 Quinn 在预览中运行并自动修复报错；生成结果可实时预览、编辑、对比版本、分享到作品广场。

## 功能

| 模块 | 能力 |
|---|---|
| 生成 | 5 家模型服务商（默认通义千问，OpenAI 兼容）；逐字流式输出；参考图生成 |
| 智能体 | Emma 需求分析 → Alex 编码 → Quinn 运行检查，发现报错自动修复（最多 2 次，可在设置中关闭） |
| 增量修改 | 迭代时模型优先输出 SEARCH/REPLACE 补丁，只改动相关片段；未匹配的补丁会提示并跳过 |
| 工作区 | 预览（桌面/平板/手机三种宽度）、CodeMirror 代码编辑、版本列表、回退、两个版本逐行对比 |
| 会话 | 侧栏新建、搜索、重命名、删除；本地持久化，登录后同步到云端 |
| 分享 | 生成公开链接；“我的分享”可撤回、切换是否公开；作品广场可“基于此修改”复制到新会话 |
| 账号与密钥 | Atoms 登录注册；API Key 可只存在浏览器，或加密保存到服务器 |
| 导出 | 单个 HTML 文件 / ZIP |

## 架构

```
浏览器 (React + Vite + shadcn/ui)
 ├─ 直连模型接口（密钥保存在本地时，逐字流式）
 └─ Atoms Cloud 后端 (FastAPI)
     ├─ /api/v1/llm/proxy        模型转发（直连失败或密钥存服务器时使用）
     ├─ /api/v1/keys             API Key 加密存储（Fernet，按用户隔离，不回传明文）
     ├─ /api/v1/share            创建分享、我的分享、作品广场、撤回、公开开关、复用
     └─ entities/chat_sessions   会话云端同步
```

### 数据表

| 表 | 说明 |
|---|---|
| `app_shares` | 分享记录：创建者、标题、合并后的 HTML、源文件 JSON、是否公开、被复用次数 |
| `shared_apps` | 旧版分享（无创建者），仅保留读取，旧链接继续可用 |
| `chat_sessions` | 用户会话（JSON），按 `session_key` 同步 |
| `user_api_keys` | 加密后的 API Key，按用户与服务商保存 |

### 前端目录（`app/frontend/src`）

| 路径 | 职责 |
|---|---|
| `pages/Index.tsx` | 页面组装、Quinn 自检循环 |
| `pages/Share.tsx` | 分享页 `/share/:id` |
| `hooks/useGenerator.ts` | 单轮生成、流式解析、补丁应用、进度 |
| `hooks/useSessions.ts`、`useUserSettings.ts` | 会话与配置持久化 |
| `lib/llm.ts` | 服务商请求构造、SSE 解析、直连/转发 |
| `lib/project.ts` | 输出解析、补丁、预览拼装、导出 |
| `lib/diff.ts` | 版本逐行对比 |
| `lib/cloudSync.ts`、`lib/backend.ts` | 云端同步、分享与密钥接口 |
| `components/builder/*` | 顶栏、会话侧栏、对话、工作区、版本对比、分享弹窗、设置 |

## 运行与测试

```bash
cd app/frontend
pnpm install
pnpm run dev      # 开发预览
pnpm test         # 单元测试（vitest，覆盖解析、补丁、预览拼装、diff）
pnpm run lint
pnpm run build    # 产物在 dist/
```

后端依赖 Atoms Cloud 运行环境，在本地无法独立启动；登录、分享、云端同步、服务器存密钥都依赖它。

## 使用

1. 点击“登录 / 注册”。
2. 打开设置：选择服务商，填写 API Key，选择密钥保存方式，按需开关“生成后自动检查并修复”。
3. 输入需求或上传参考图，等待智能体完成；在工作区预览、编辑代码、对比版本。
4. 点击“分享链接”，选择是否公开到作品广场；在“⋯ → 我的分享 / 作品广场”管理。

## 已知限制

- 后端转发在当前运行环境下可能等全部生成完才返回，不是逐字输出；密钥存服务器时只能走转发。
- 自动修复只能发现运行时报错（脚本错误、未处理的 Promise、console.error），发现不了界面或逻辑问题。
- 补丁的 SEARCH 内容必须与原代码逐字一致，模型给出的内容对不上时该处修改会被跳过。
- 多设备同时修改同一个会话时，按更新时间保留较新的一份，可能互相覆盖。
- 旧版分享链接不能撤回。
