import { client } from '@/lib/client';
import { buildPreview, type Files } from '@/lib/project';

/** Extracts a readable message from a web-sdk / axios error. */
export function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { detail?: string } }; data?: { detail?: string }; message?: string };
  return err?.response?.data?.detail || err?.data?.detail || err?.message || fallback;
}

export async function createShareLink(title: string, files: Files): Promise<string> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/share',
    method: 'POST',
    data: { title, html: buildPreview(files) },
  });
  return `${window.location.origin}/share/${res.data.id}`;
}

export async function listServerKeys(): Promise<string[]> {
  const res = await client.apiCall.invoke({ url: '/api/v1/keys', method: 'GET', data: {} });
  return res.data?.providers ?? [];
}

export async function saveServerKey(provider: string, apiKey: string) {
  await client.apiCall.invoke({ url: '/api/v1/keys', method: 'PUT', data: { provider, api_key: apiKey } });
}

export async function deleteServerKey(provider: string) {
  await client.apiCall.invoke({ url: `/api/v1/keys/${provider}`, method: 'DELETE', data: {} });
}

export interface ShareItem {
  id: number;
  title: string;
  is_public: boolean;
  remix_count: number;
  created_at: string | null;
}

export async function publishShare(title: string, files: Files, isPublic: boolean): Promise<string> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/share',
    method: 'POST',
    data: { title, html: buildPreview(files), files_json: JSON.stringify(files), is_public: isPublic },
  });
  return `${window.location.origin}/share/${res.data.id}`;
}

export async function listMyShares(): Promise<ShareItem[]> {
  return (await client.apiCall.invoke({ url: '/api/v1/share/mine', method: 'GET', data: {} })).data.items;
}

export async function listGallery(): Promise<ShareItem[]> {
  return (await client.apiCall.invoke({ url: '/api/v1/share/gallery', method: 'GET', data: { limit: 48 } })).data.items;
}

export async function updateShare(id: number, data: { is_public?: boolean }) {
  await client.apiCall.invoke({ url: `/api/v1/share/${id}`, method: 'PATCH', data });
}

export async function deleteShare(id: number) {
  await client.apiCall.invoke({ url: `/api/v1/share/${id}`, method: 'DELETE', data: {} });
}

export async function remixShare(id: number): Promise<{ title: string; files: Files }> {
  const d = (await client.apiCall.invoke({ url: `/api/v1/share/${id}/remix`, method: 'POST', data: {} })).data;
  let files: Files = { 'index.html': d.html };
  try {
    if (d.files_json) files = JSON.parse(d.files_json);
  } catch {
    /* fall back to merged html */
  }
  return { title: d.title, files };
}
