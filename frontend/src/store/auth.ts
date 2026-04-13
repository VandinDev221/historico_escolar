import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/lib/api';

interface AuthState {
  token: string | null;
  user: User | null;
  /** timestamp em ms de quando o usuário autenticou (para controle de sessão) */
  loginAt: number | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      loginAt: null,
      setAuth: (token, user) => {
        if (typeof window !== 'undefined') localStorage.setItem('token', token);
        set({ token, user, loginAt: Date.now() });
      },
      logout: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('token');
        set({ token: null, user: null, loginAt: null });
      },
    }),
    { name: 'auth-storage' }
  )
);
