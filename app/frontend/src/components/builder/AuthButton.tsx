import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { LogIn, LogOut, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { loadUser, saveUser, type CachedUser } from '@/lib/storage';

export { client };

export type AuthState = 'loading' | 'authenticated' | 'anonymous';

export function useAuth() {
  const [user, setUser] = useState<CachedUser | null>(loadUser);
  const [state, setState] = useState<AuthState>(() => (loadUser() ? 'authenticated' : 'loading'));

  useEffect(() => {
    const timer = setTimeout(() => setState((s) => (s === 'loading' ? 'anonymous' : s)), 4000);
    client.auth
      .me()
      .then((res) => {
        const d = res?.data as Record<string, unknown> | undefined;
        if (d) {
          const u: CachedUser = { id: String(d.id ?? d.user_id ?? d.sub ?? d.email), name: d.name as string, email: d.email as string };
          saveUser(u);
          setUser(u);
          setState('authenticated');
        } else {
          saveUser(null);
          setUser(null);
          setState('anonymous');
        }
      })
      .catch(() => {
        saveUser(null);
        setUser(null);
        setState('anonymous');
      })
      .finally(() => clearTimeout(timer));
    return () => clearTimeout(timer);
  }, []);

  return { state, user };
}

export function logout() {
  saveUser(null);
  client.auth.logout();
}

export default function AuthButton({ state }: { state: AuthState }) {
  const btn =
    'flex h-9 items-center gap-1.5 rounded-lg border border-[#2A2C31] px-3 text-sm transition-colors duration-150 hover:border-[#C6F432] disabled:opacity-40';
  if (state === 'loading')
    return (
      <button className={btn} disabled aria-label="加载中">
        …
      </button>
    );
  if (state === 'anonymous')
    return (
      <button className={`${btn} border-[#C6F432] text-[#C6F432]`} onClick={() => client.auth.toLogin()}>
        <LogIn className="h-4 w-4" />
        <span className="whitespace-nowrap">登录 / 注册</span>
      </button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="账户" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C6F432] text-[#111214]">
          <User className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
