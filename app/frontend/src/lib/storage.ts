import type { Message, Version } from '@/lib/project';

export interface CachedUser {
  id: string;
  name?: string;
  email?: string;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  versions: Version[];
  current: number | null;
  updatedAt: number;
}

export interface SessionStore {
  sessions: Session[];
  activeId: string;
}

const USER_KEY = 'atoms-demo:user';
const sessionsKey = (uid: string) => `atoms-demo:sessions:${uid}`;
export const settingsKey = (uid: string) => `atoms-demo:settings:${uid}`;

export const uid = () => Math.random().toString(36).slice(2);

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function loadUser() {
  return read<CachedUser>(USER_KEY);
}

export function saveUser(user: CachedUser | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function newSession(): Session {
  return { id: uid(), title: '新会话', messages: [], versions: [], current: null, updatedAt: Date.now() };
}

export function loadSessions(userId: string): SessionStore {
  const store = read<SessionStore>(sessionsKey(userId));
  if (store?.sessions?.length) {
    store.sessions = store.sessions.map((s) => ({
      ...s,
      messages: s.messages.map((m) => (m.status === 'working' ? { ...m, status: 'error', content: m.content || '已中断' } : m)),
    }));
    if (!store.sessions.some((s) => s.id === store.activeId)) store.activeId = store.sessions[0].id;
    return store;
  }
  const first = newSession();
  return { sessions: [first], activeId: first.id };
}

export function saveSessions(userId: string, store: SessionStore) {
  try {
    localStorage.setItem(sessionsKey(userId), JSON.stringify(store));
  } catch {
    /* quota exceeded: keep in memory */
  }
}
