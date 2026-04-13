'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  if (user.role === 'PAIS_RESPONSAVEL') {
    return (
      <AppLayout>
        <div className="rounded-lg border bg-card p-6 max-w-xl">
          <h2 className="font-medium text-card-foreground mb-2">Área do responsável</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Use o menu ao lado para acessar seu perfil e atualizar seus dados. Para informações sobre matrículas ou declarações, entre em contato com a secretaria da escola.
          </p>
          <Link
            href="/perfil"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Meu perfil
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/escolas"
            className="rounded-lg border bg-card p-6 shadow-sm hover:bg-accent/50 transition"
          >
            <h2 className="font-medium text-card-foreground">Escolas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Listar escolas e acessar alunos por unidade
            </p>
          </Link>
          <Link
            href="/alunos"
            className="rounded-lg border bg-card p-6 shadow-sm hover:bg-accent/50 transition"
          >
            <h2 className="font-medium text-card-foreground">Alunos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerenciar cadastro e matrículas (selecionar escola)
            </p>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border bg-card p-6 shadow-sm hover:bg-accent/50 transition"
          >
            <h2 className="font-medium text-card-foreground">Dashboard</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Indicadores por escola e ano, gráficos e exportação
            </p>
          </Link>
          {user.role !== 'PROFESSOR' && (
            <Link
              href="/documentos"
              className="rounded-lg border bg-card p-6 shadow-sm hover:bg-accent/50 transition"
            >
              <h2 className="font-medium text-card-foreground">Documentos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Declarações (matrícula, transferência, conclusão, frequência)
              </p>
            </Link>
          )}
      </div>
    </AppLayout>
  );
}
