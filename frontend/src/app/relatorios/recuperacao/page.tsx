'use client';

import { Suspense, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { useAuthStore } from '@/store/auth';
import { getRecovery } from '@/lib/api';
import { fetchWithAuth } from '@/lib/api';

interface School {
  id: string;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function RecuperacaoPageContent() {
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [schoolId, setSchoolId] = useState(searchParams.get('schoolId') || '');
  const [year, setYear] = useState(Number(searchParams.get('year')) || CURRENT_YEAR);

  const effectiveSchoolId = user?.role === 'SUPER_ADMIN' ? schoolId : (user?.schoolId ?? '');

  const { data: schools } = useQuery({
    queryKey: ['schools'],
    queryFn: () => fetchWithAuth<School[]>('/schools'),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: recovery, isLoading } = useQuery({
    queryKey: ['reports', 'recovery', effectiveSchoolId, year],
    queryFn: () => getRecovery(effectiveSchoolId, year),
    enabled: !!effectiveSchoolId,
  });

  useEffect(() => {
    const sid = searchParams.get('schoolId');
    const y = searchParams.get('year');
    if (sid) setSchoolId(sid);
    if (y) setYear(Number(y));
  }, [searchParams]);

  if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN_ESCOLAR' && user?.role !== 'PROFESSOR') {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Acesso restrito.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Alunos em recuperação</h2>
        <Link href="/relatorios" className="text-sm text-primary hover:underline">
          ← Voltar aos relatórios
        </Link>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        {user?.role === 'SUPER_ADMIN' && (
          <div>
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
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Ano letivo</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {!effectiveSchoolId && <p className="text-muted-foreground">Selecione uma escola.</p>}
      {effectiveSchoolId && isLoading && <p className="text-muted-foreground">Carregando...</p>}

      {effectiveSchoolId && recovery && (
        <div className="rounded-lg border bg-card p-4">
          {recovery.items.length === 0 ? (
            <p className="text-muted-foreground">Nenhum aluno em recuperação no ano selecionado.</p>
          ) : (
            <ul className="space-y-4">
              {recovery.items.map((item) => (
                <li key={item.enrollmentId} className="rounded border p-4">
                  <div className="font-medium">{item.student.name}</div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {item.series} – {item.year}
                  </div>
                  <ul className="text-sm space-y-1">
                    {item.disciplines
                      .filter((d) => d.avgScore < 6)
                      .map((d) => (
                        <li key={d.subject}>
                          <span className="font-medium">{d.subject}</span>: média {d.avgScore.toFixed(1)}
                          {d.recoveryScore != null && ` | Rec: ${d.recoveryScore.toFixed(1)}`}
                          {d.inRecovery && <span className="text-amber-600 ml-1">(em recuperação)</span>}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AppLayout>
  );
}

export default function RecuperacaoPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <p className="text-muted-foreground">Carregando...</p>
        </AppLayout>
      }
    >
      <RecuperacaoPageContent />
    </Suspense>
  );
}
