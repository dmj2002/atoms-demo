---
last_updated: 2026-10-09T07:39:54Z
---

# Architecture Design

## System Overview
Pure frontend Atoms-like builder: user prompt → LLM (user's own key, browser direct call, streaming) → multi-file project parsed from `<plan>`/`<file path>` tags → iframe preview, file tree, versions (localStorage), HTML/ZIP export.

## Tech Stack
Vite + React + TS + shadcn/ui + Tailwind, jszip.

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| LLM | Provider configs & SSE streaming (OpenAI-compat, DeepSeek, Gemini, Anthropic) | src/lib/llm.ts |
| Project | Prompt, output parsing, preview merge, export | src/lib/project.ts |
| UI | Chat panel, workspace, settings | src/pages/Index.tsx, src/components/builder/* |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | None, keys in localStorage | User requested pure frontend |
| Iteration | Send current files + new request; merge returned files | Token economy |

## File Tree Plan
src/lib/{llm,project}.ts, src/components/builder/{ChatPanel,Workspace,SettingsDialog}.tsx, src/pages/Index.tsx

## Implementation Guide
Preview inlines css/js into index.html via srcDoc sandbox iframe.

