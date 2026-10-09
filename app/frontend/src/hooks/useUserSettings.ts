import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSettings, saveSettings, type Settings } from '@/lib/llm';
import { settingsKey } from '@/lib/storage';

/** Model settings stored per user in localStorage. */
export function useUserSettings(userKey: string) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings(settingsKey(userKey)));
  const owner = useRef(userKey);

  useEffect(() => {
    if (owner.current === userKey) return;
    owner.current = userKey;
    setSettings(loadSettings(settingsKey(userKey)));
  }, [userKey]);

  const save = useCallback(
    (s: Settings) => {
      setSettings(s);
      saveSettings(s, settingsKey(userKey));
    },
    [userKey],
  );

  const keyReady = settings.keyStorage === 'server' ? !!settings.serverKeyReady : !!settings.apiKey;

  return { settings, save, keyReady };
}
