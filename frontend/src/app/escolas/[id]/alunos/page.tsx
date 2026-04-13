'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';

interface Student {
  id: string;
  name: string;
  birthDate: string;
  cpf: string | null;
  schoolId: string;
}

interface StudentsResponse {
  items: Student[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface School {
  id: string;
  name: string;
  code: string | null;
}

export default function AlunosPage() {
  const params = useParams();
  const schoolId = params.id as string;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 20;

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => fetchWithAuth<School>(`/schools/${schoolId}`),
    enabled: !!schoolId,
  });

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['students', schoolId, page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      return fetchWithAuth<StudentsResponse>(`/schools/${schoolId}/students?${params}`);
    },
    enabled: !!schoolId,
  });

  const students = data?.items ?? [];

  if (isLoading) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Carregando alunos...</p>
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
      <p className="mb-4">
        <Link href="/escolas" className="text-primary hover:underline">← Escolas</Link>
      </p>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h2 className="text-2xl font-semibold">
            Alunos{school?.name ? ` — ${school.name}` : ''}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Buscar por nome ou CPF..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Link
              href={`/escolas/${schoolId}/alunos/novo`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Novo aluno
            </Link>
          </div>
        </div>
        <ul className="space-y-3">
          {students?.map((s) => (
            <li key={s.id}>
              <div className="rounded-lg border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`/escolas/${schoolId}/alunos/${s.id}`}
                  className="flex-1 min-w-0 hover:opacity-90"
                >
                  <span className="font-medium">{s.name}</span>
                  <p className="text-sm text-muted-foreground">
                    Nasc.: {new Date(s.birthDate).toLocaleDateString('pt-BR')}
                    {s.cpf && ` • CPF: ${s.cpf}`}
                  </p>
                </Link>
                <Link
                  href={`/escolas/${schoolId}/alunos/${s.id}#nova-matricula`}
                  className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground whitespace-nowrap"
                >
                  Criar matrícula
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {students.length === 0 && !isLoading && (
          <p className="text-muted-foreground">
            {search ? 'Nenhum aluno encontrado para essa busca.' : 'Nenhum aluno cadastrado nesta escola.'}
          </p>
        )}
        {data && data.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-muted-foreground">
              Página {data.page} de {data.totalPages} ({data.total} alunos)
            </span>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        )}
    </AppLayout>
  );
}
