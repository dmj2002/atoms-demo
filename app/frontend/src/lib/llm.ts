import { client } from "@/lib/client";

export type Provider = "qwen" | "openai" | "deepseek" | "gemini" | "anthropic";

export interface Settings {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  model: string;
  visionModel?: string;
  keyStorage?: "local" | "server";
  serverKeyReady?: boolean;
  autoFix?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

export const PROVIDERS: Record<
  Provider,
  { label: string; baseUrl: string; model: string; visionModel: string }
> = {
  qwen: {
    label: "通义千问 Qwen（OpenAI 兼容）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3-coder-plus",
    visionModel: "qwen3-vl-plus",
  },
  openai: {
    label: "OpenAI 兼容接口",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.5",
    visionModel: "gpt-5.5",
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-pro",
    visionModel: "deepseek-v4-pro",
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    model: "gemini-3.1-pro-preview",
    visionModel: "gemini-3.1-pro-preview",
  },
  anthropic: {
    label: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com",
    model: "claude-opus-4.6",
    visionModel: "claude-opus-4.6",
  },
};

const SETTINGS_KEY = "atoms-demo-settings";

export function loadSettings(key = SETTINGS_KEY): Settings {
  try {
    const raw = localStorage.getItem(key) ?? localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as Settings;
  } catch {
    /* ignore corrupted settings */
  }
  return {
    provider: "qwen",
    apiKey: "",
    baseUrl: PROVIDERS.qwen.baseUrl,
    model: PROVIDERS.qwen.model,
    visionModel: PROVIDERS.qwen.visionModel,
  };
}

export function saveSettings(s: Settings, key = SETTINGS_KEY) {
  localStorage.setItem(key, JSON.stringify(s));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  pick: (j: any) => string | undefined;
}

const split = (url: string) => {
  const m = url.match(/^data:([^;]+);base64,(.*)$/);
  return { mime: m?.[1] ?? "image/jpeg", data: m?.[2] ?? "" };
};

function buildRequest(
  s: Settings,
  system: string,
  messages: ChatMessage[],
): ProviderRequest {
  const base = s.baseUrl.replace(/\/$/, "");
  const hasImages = messages.some((m) => m.images?.length);
  const model = hasImages
    ? s.visionModel || PROVIDERS[s.provider].visionModel
    : s.model;

  if (s.provider === "gemini") {
    return {
      url: `${base}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(s.apiKey)}`,
      headers: {},
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [
            { text: m.content },
            ...(m.images ?? []).map((u) => ({
              inline_data: { mime_type: split(u).mime, data: split(u).data },
            })),
          ],
        })),
      },
      pick: (j) =>
        j.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text ?? "")
          .join(""),
    };
  }
  if (s.provider === "anthropic") {
    return {
      url: `${base}/v1/messages`,
      headers: { "x-api-key": s.apiKey, "anthropic-version": "2023-06-01" },
      body: {
        model,
        max_tokens: 16000,
        system,
        stream: true,
        messages: messages.map((m) =>
          m.images?.length
            ? {
                role: m.role,
                content: [
                  ...m.images.map((u) => ({
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: split(u).mime,
                      data: split(u).data,
                    },
                  })),
                  { type: "text", text: m.content },
                ],
              }
            : { role: m.role, content: m.content },
        ),
      },
      pick: (j) =>
        j.type === "content_block_delta" ? j.delta?.text : undefined,
    };
  }
  return {
    url: `${base}/chat/completions`,
    headers: { Authorization: `Bearer ${s.apiKey}` },
    body: {
      model,
      stream: true,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) =>
          m.images?.length
            ? {
                role: m.role,
                content: [
                  { type: "text", text: m.content },
                  ...m.images.map((u) => ({
                    type: "image_url",
                    image_url: { url: u },
                  })),
                ],
              }
            : { role: m.role, content: m.content },
        ),
      ],
    },
    pick: (j) => j.choices?.[0]?.delta?.content,
  };
}

function errorDetail(e: any): string {
  const raw = e?.response?.data ?? e?.data;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw).detail ?? raw.slice(0, 300);
    } catch {
      return raw.slice(0, 300);
    }
  }
  return raw?.detail || e?.message || "请求失败";
}

/** Streams a chat completion through the backend proxy (avoids browser CORS). */
export async function streamChat(
  s: Settings,
  system: string,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  signal: AbortSignal,
) {
  const server = s.keyStorage === "server";
  if (server ? !s.serverKeyReady : !s.apiKey)
    throw new Error("请先在设置中填写 API Key");
  const req = buildRequest(
    server ? { ...s, apiKey: "__SERVER_KEY__" } : s,
    system,
    messages,
  );

  let seen = 0;
  let buffer = "";
  const consume = (full: string) => {
    if (full.length <= seen) return;
    buffer += full.slice(seen);
    seen = full.length;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const text = req.pick(JSON.parse(data));
        if (text) onDelta(text);
      } catch {
        /* skip malformed chunk */
      }
    }
  };

  // 1) Direct browser streaming (true token-by-token). 2) Fallback to backend proxy if blocked by CORS/network.
  let direct: Response | null = null;
  if (!server)
    try {
      direct = await fetch(req.url, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          ...req.headers,
          ...(s.provider === "anthropic"
            ? { "anthropic-dangerous-direct-browser-access": "true" }
            : {}),
        },
        body: JSON.stringify(req.body),
      });
    } catch {
      if (signal.aborted) throw new Error("已停止生成");
      direct = null;
    }
  if (direct) {
    if (!direct.ok)
      throw new Error(
        `模型接口返回 ${direct.status}：${(await direct.text()).slice(0, 300)}`,
      );
    const reader = direct.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        consume(text);
      }
    } catch (e) {
      if (signal.aborted) throw new Error("已停止生成");
      throw e;
    }
    consume(text + "\n");
    return;
  }

  // Backend relay via job + polling: the host buffers whole responses, so one request runs the
  // generation and checkpoints upstream SSE payloads to the DB while we poll for new lines.
  const jobKey = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let runError = "";
  let runDone = false;
  const run = client.apiCall
    .invoke({
      url: "/api/v1/llm/jobs/run",
      method: "POST",
      data: { url: req.url, headers: req.headers, body: req.body, provider: s.provider, use_stored_key: server, job_key: jobKey },
      options: { timeout: 0 },
    } as any)
    .catch((e) => {
      runError = errorDetail(e);
    })
    .finally(() => {
      runDone = true;
    });

  let offset = 0;
  let pending = "";
  const emit = (chunk: string, final = false) => {
    pending += chunk;
    const lines = pending.split("\n");
    pending = final ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line) continue;
      try {
        const text = req.pick(JSON.parse(line));
        if (text) onDelta(text);
      } catch {
        /* skip malformed payload */
      }
    }
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const cancel = () =>
    client.apiCall.invoke({ url: `/api/v1/llm/jobs/${jobKey}/cancel`, method: "POST", data: {} }).catch(() => undefined);

  for (let idle = 0; ; ) {
    if (signal.aborted) {
      cancel();
      throw new Error("已停止生成");
    }
    await sleep(800);
    let st: { status: string; error?: string; chunk: string; offset: number };
    try {
      st = (await client.apiCall.invoke({ url: `/api/v1/llm/jobs/${jobKey}`, method: "GET", data: { offset } })).data;
    } catch (e) {
      if (++idle > 5) throw new Error(errorDetail(e));
      continue;
    }
    idle = 0;
    if (st.chunk) emit(st.chunk);
    offset = st.offset;
    if (st.status === "error") throw new Error(st.error || "生成失败");
    if (st.status === "done" || st.status === "cancelled") {
      emit("", true);
      return;
    }
    if (st.status === "pending" && runDone) {
      await run;
      throw new Error(runError || "生成任务未能启动");
    }
  }

}
