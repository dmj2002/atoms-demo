import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSessions, newSession, saveSessions, type Session, type SessionStore } from '@/lib/storage';
import type { Files } from '@/lib/project';

export type SessionPatch = Partial<Omit<Session, 'id'>>;
export type UpdateSession = (id: string, fn: (s: Session) => SessionPatch) => void;

/** Per-user session list persisted to localStorage. */
export function useSessions(userKey: string) {
  const [all, setAll] = useState<SessionStore>(() => loadSessions(userKey));
  const owner = useRef(userKey);
  const skipSave = useRef(false);

  useEffect(() => {
    if (owner.current === userKey) return;
    owner.current = userKey;
    skipSave.current = true;
    setAll(loadSessions(userKey));
  }, [userKey]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveSessions(userKey, all);
  }, [all, userKey]);

  const updateSession: UpdateSession = useCallback(
    (id, fn) =>
      setAll((a) => ({
        ...a,
        sessions: a.sessions.map((x) => (x.id === id ? { ...x, ...fn(x), updatedAt: Date.now() } : x)),
      })),
    [],
  );

  const create = useCallback(() => {
    const ns = newSession();
    setAll((a) => ({ sessions: [ns, ...a.sessions], activeId: ns.id }));
  }, []);

  const importProject = useCallback((title: string, files: Files) => {
    const ns = newSession();
    const session = {
      ...ns,
      title: `${title}（副本）`.slice(0, 40),
      versions: [{ id: 1, prompt: `复用作品：${title}`, files, createdAt: Date.now() }],
      current: 1,
    };
    setAll((a) => ({ sessions: [session, ...a.sessions], activeId: session.id }));
  }, []);

  const select = useCallback((id: string) => setAll((a) => ({ ...a, activeId: id })), []);

  const rename = useCallback(
    (id: string, title: string) => updateSession(id, () => ({ title: title.trim() || '未命名会话' })),
    [updateSession],
  );

  const remove = useCallback(
    (id: string) =>
      setAll((a) => {
        const rest = a.sessions.filter((x) => x.id !== id);
        const list = rest.length ? rest : [newSession()];
        return { sessions: list, activeId: a.activeId === id ? list[0].id : a.activeId };
      }),
    [],
  );

  const store = all.sessions.find((x) => x.id === all.activeId) ?? all.sessions[0];
  const currentFiles: Files = store.versions.find((v) => v.id === store.current)?.files ?? {};

  return { all, setAll, store, currentFiles, updateSession, create, importProject, select, rename, remove };
}
