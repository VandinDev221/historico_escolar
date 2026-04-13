'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';

interface School {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
}

interface Enrollment {
  id: string;
  year: number;
  series: string;
  situation: string;
}

export default function DocumentosPage() {
  const user = useAuthStore((s) => s.user);
  const [schoolId, setSchoolId] = useState('');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canGenerateDeclaration = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_ESCOLAR';
  const effectiveSchoolId = isSuperAdmin ? schoolId : (user?.schoolId ?? '');

  const { data: schools } = useQuery({
    queryKey: ['schools'],
    queryFn: () => fetchWithAuth<School[]>('/schools'),
  });

  return (
    <AppLayout>
      <h2 className="text-2xl font-semibold mb-6">Documentos e declarações</h2>

        {isSuperAdmin && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-muted-foreground mb-1">Escola</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 min-w-[200px]"
            >
              <option value="">Selecione...</option>
              {schools?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {!effectiveSchoolId ? (
          <p className="text-muted-foreground">Selecione uma escola para gerir declarações.</p>
        ) : canGenerateDeclaration ? (
          <Link
            href={`/documentos/${effectiveSchoolId}/gerar`}
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 mb-6"
          >
            Gerar declaração
          </Link>
        ) : null}

        {effectiveSchoolId && (
          <DocumentList schoolId={effectiveSchoolId} />
        )}
    </AppLayout>
  );
}

interface DocItem {
  id: string;
  type: string;
  validationCode: string;
  createdAt: string;
  student: { name: string };
}

function DocumentList({ schoolId }: { schoolId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['documents', schoolId, page],
    queryFn: () =>
      fetchWithAuth<{ items: DocItem[]; total: number; page: number; totalPages: number }>(
        `/documents/schools/${schoolId}?page=${page}&limit=20`
      ),
  });
  const docs = data?.items ?? [];

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (docs.length === 0 && !data) return <p className="text-muted-foreground">Nenhum documento gerado nesta escola.</p>;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    <>
    <ul className="space-y-3">
      {docs.map((d) => (
        <li key={d.id} className="rounded-lg border bg-card p-4 flex justify-between items-center flex-wrap gap-2">
          <div>
            <span className="font-medium">{d.student.name}</span>
            <span className="ml-2 text-sm text-muted-foreground">— {d.type}</span>
            <p className="text-xs text-muted-foreground mt-1">{new Date(d.createdAt).toLocaleString('pt-BR')}</p>
          </div>
          <a
            href={`${baseUrl}/validar/${d.validationCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Validar: {d.validationCode}
          </a>
        </li>
      ))}
    </ul>
    {data && data.totalPages > 1 && (
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-muted-foreground">
          Página {data.page} de {data.totalPages}
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
    </>
  );
}
