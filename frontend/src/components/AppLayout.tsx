'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { GlobalSearch } from './GlobalSearch';

interface AppLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/', label: 'Início' },
  { href: '/escolas', label: 'Escolas' },
  { href: '/alunos', label: 'Alunos' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/documentos', label: 'Documentos' },
] as const;

const SESSION_DURATION_MS = 60 * 60 * 1000; // 60 minutos

function formatRemaining(seconds: number): string {
  const s = Math.max(0, seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout, loginAt } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !loginAt) {
      setRemainingSeconds(null);
      return;
    }

    const deadline = loginAt + SESSION_DURATION_MS;

    const update = () => {
      const diffMs = deadline - Date.now();
      const next = Math.floor(diffMs / 1000);
      if (next <= 0) {
        // expira sessão
        logout();
        router.push('/login');
        setRemainingSeconds(0);
        return false;
      }
      setRemainingSeconds(next);
      return true;
    };

    // atualização imediata
    if (!update()) {
      return;
    }

    const id = setInterval(() => {
      const ok = update();
      if (!ok) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [user, loginAt, logout, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Barra lateral */}
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Link href="/" className="text-lg font-semibold text-primary">
            Histórico Escolar
          </Link>
        </div>
        <nav className="p-3 flex-1">
          <ul className="space-y-1">
            {NAV_ITEMS.filter((item) => {
              if (user?.role === 'PAIS_RESPONSAVEL') return item.href === '/';
              if (item.href === '/documentos' && user?.role === 'PROFESSOR') return false;
              return true;
            }).map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive(href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
            {user?.role === 'PAIS_RESPONSAVEL' && (
              <li>
                <Link
                  href="/meus-filhos"
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                    pathname.startsWith('/meus-filhos')
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  Meus filhos
                </Link>
              </li>
            )}
            <li className="pt-2 mt-2 border-t">
              <Link
                href="/perfil"
                className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                  pathname === '/perfil'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                Meu perfil
              </Link>
            </li>
            {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_ESCOLAR') && (
              <li className="pt-1">
                <Link
                  href="/relatorios"
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                    pathname.startsWith('/relatorios')
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  Relatórios
                </Link>
              </li>
            )}
            {user?.role === 'SUPER_ADMIN' && (
              <li className="pt-1 space-y-1">
                <Link
                  href="/usuarios"
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                    pathname.startsWith('/usuarios')
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  Usuários
                </Link>
                <Link
                  href="/dev/logs"
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                    pathname.startsWith('/dev')
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  Logs (dev)
                </Link>
              </li>
            )}
          </ul>
        </nav>
        {user && (
          <div className="p-3 border-t text-xs text-muted-foreground">
            <p className="truncate" title={user.email}>{user.name}</p>
            <p className="truncate">{user.role.replace('_', ' ')}</p>
          </div>
        )}
      </aside>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 border-b bg-card shrink-0">
          <div className="px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] max-w-xl">
              <GlobalSearch />
            </div>
            {user && (
              <div className="flex items-center gap-4 shrink-0">
                {remainingSeconds !== null && (
                  <span className="text-xs text-muted-foreground">
                    Sessão: {formatRemaining(remainingSeconds)}
                  </span>
                )}
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-destructive hover:underline"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
