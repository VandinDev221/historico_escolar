'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';

interface School {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  municipality: { name: string; state: string };
}

export default function EscolasPage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isGestor = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_ESCOLAR';
  const isProfessor = user?.role === 'PROFESSOR';

  const { data: schools, isLoading, error } = useQuery({
    queryKey: ['schools'],
    queryFn: () => fetchWithAuth<School[]>('/schools'),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Carregando escolas...</p>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <p className="text-destructive">{error.message}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Escolas</h2>
          {isSuperAdmin && (
            <Link
              href="/escolas/nova"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Cadastrar escola
            </Link>
          )}
        </div>
        <ul className="space-y-3">
          {schools?.map((s) => (
            <li key={s.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                  <span className="font-medium">{s.name}</span>
                  {s.code && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      Código: {s.code}
                    </span>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {s.municipality.name} / {s.municipality.state}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link
                    href={`/escolas/${s.id}/alunos`}
                    className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
                  >
                    Alunos
                  </Link>
                  {(isGestor || isProfessor) && (
                    <Link
                      href={`/escolas/${s.id}/turmas`}
                      className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
                    >
                      Turmas
                    </Link>
                  )}
                  {isGestor && (
                    <Link
                      href={`/escolas/${s.id}/materias`}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Disciplinas
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {schools?.length === 0 && (
          <p className="text-muted-foreground">Nenhuma escola cadastrada.</p>
        )}
    </AppLayout>
  );
}
