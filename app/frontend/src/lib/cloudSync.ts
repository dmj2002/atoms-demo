import { useEffect, useRef, useState } from 'react';
import { client } from '@/lib/client';
import type { Session, SessionStore } from '@/lib/storage';

interface Row {
  id: number;
  session_key: string;
  title: string;
  data: string;
  updated_ms: number;
}

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

/** Two-way sync of local sessions with the user's cloud chat_sessions table. */
export function useCloudSync(enabled: boolean, all: SessionStore, setAll: (fn: (a: SessionStore) => SessionStore) => void) {
  const [status, setStatus] = useState<SyncStatus>('off');
  const ids = useRef<Record<string, number>>({});
  const synced = useRef<Record<string, number>>({});
  const loaded = useRef(false);

  useEffect(() => {
    if (!enabled || loaded.current) return;
    setStatus('syncing');
    client.entities.chat_sessions
      .query({ query: {}, limit: 200, sort: '-updated_ms' })
      .then((res) => {
        const rows = (res.data?.items ?? []) as Row[];
        const remote: Session[] = [];
        rows.forEach((r) => {
          ids.current[r.session_key] = r.id;
          synced.current[r.session_key] = r.updated_ms;
          try {
            remote.push(JSON.parse(r.data) as Session);
          } catch {
            /* skip corrupted row */
          }
        });
        setAll((a) => {
          const map = new Map(a.sessions.map((s) => [s.id, s]));
          remote.forEach((s) => {
            const local = map.get(s.id);
            if (!local || s.updatedAt > local.updatedAt) map.set(s.id, s);
          });
          const sessions = [...map.values()]
            .filter((s) => s.messages.length || s.id === a.activeId)
            .sort((x, y) => y.updatedAt - x.updatedAt);
          return { sessions, activeId: sessions.some((s) => s.id === a.activeId) ? a.activeId : sessions[0].id };
        });
        loaded.current = true;
        setStatus('synced');
      })
      .catch(() => setStatus('error'));
  }, [enabled, setAll]);

  useEffect(() => {
    if (!enabled || !loaded.current) return;
    const timer = setTimeout(async () => {
      const keys = new Set(all.sessions.map((s) => s.id));
      const dirty = all.sessions.filter((s) => s.messages.length && s.updatedAt !== synced.current[s.id]);
      const removed = Object.keys(ids.current).filter((k) => !keys.has(k));
      if (!dirty.length && !removed.length) return;
      setStatus('syncing');
      try {
        for (const s of dirty) {
          const payload = {
            session_key: s.id,
            title: s.title,
            updated_ms: s.updatedAt,
            data: JSON.stringify({ ...s, messages: s.messages.map((m) => (m.status === 'working' ? { ...m, status: 'error' } : m)) }),
          };
          const id = ids.current[s.id];
          if (id) await client.entities.chat_sessions.update({ id: String(id), data: payload });
          else ids.current[s.id] = (await client.entities.chat_sessions.create({ data: payload })).data.id;
          synced.current[s.id] = s.updatedAt;
        }
        for (const k of removed) {
          await client.entities.chat_sessions.delete({ id: String(ids.current[k]) });
          delete ids.current[k];
        }
        setStatus('synced');
      } catch {
        setStatus('error');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [all, enabled]);

  return status;
}
