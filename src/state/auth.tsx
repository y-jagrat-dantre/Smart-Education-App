import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { getSignedInUser, registerAccount, setAccountToken, signIn, type AccountUser } from '@/services/api';
import { useAppStore } from '@/state/app-store';

const SESSION_KEY = 'smart-education.account-session';

type AuthContextValue = {
  user: AccountUser | null;
  ready: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  createAccount: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readSavedSession() {
  if (Platform.OS === 'web') return typeof window === 'undefined' ? null : window.localStorage.getItem(SESSION_KEY);
  return SecureStore.getItemAsync(SESSION_KEY);
}

async function writeSavedSession(value: string | null) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    if (value) window.localStorage.setItem(SESSION_KEY, value);
    else window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  if (value) await SecureStore.setItemAsync(SESSION_KEY, value);
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await readSavedSession();
        if (!saved) return;
        const session = JSON.parse(saved) as { token?: string };
        if (!session.token) return;
        setAccountToken(session.token);
        const response = await getSignedInUser() as { user?: AccountUser };
        if (active && response.user) setUser(response.user);
      } catch {
        setAccountToken(null);
        await writeSavedSession(null).catch(() => undefined);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const establishSession = async (request: Promise<{ token: string; user: AccountUser }>) => {
    const session = await request;
    const activePomodoro = useAppStore.getState().activePomodoro;
    if (activePomodoro && activePomodoro.userId !== session.user.id) {
      useAppStore.getState().endPomodoro(activePomodoro.userId);
    }
    const activeStudySession = useAppStore.getState().activeStudySession;
    if (activeStudySession && activeStudySession.userId !== session.user.id) {
      useAppStore.getState().pauseStudySession();
      useAppStore.getState().completeStudySession(activeStudySession.userId);
    }
    setAccountToken(session.token);
    setUser(session.user);
    try { await writeSavedSession(JSON.stringify({ token: session.token })); }
    catch { /* The active session still works if this device cannot save it. */ }
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    signInWithPassword: (email, password) => establishSession(signIn(email, password)),
    createAccount: (name, email, password) => establishSession(registerAccount(name, email, password)),
    signOut: async () => {
      const activePomodoro = useAppStore.getState().activePomodoro;
      if (activePomodoro && activePomodoro.userId === user?.id) {
        useAppStore.getState().endPomodoro(activePomodoro.userId);
      }
      const activeStudySession = useAppStore.getState().activeStudySession;
      if (activeStudySession && activeStudySession.userId === user?.id) {
        useAppStore.getState().pauseStudySession();
        useAppStore.getState().completeStudySession(activeStudySession.userId);
      }
      setAccountToken(null);
      setUser(null);
      await writeSavedSession(null).catch(() => undefined);
    },
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
