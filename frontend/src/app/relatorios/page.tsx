'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { useAuthStore } from '@/store/auth';
import { getAlerts, notifyConselhoTutelar } from '@/lib/api';
import { fetchWithAuth } from '@/lib/api';

interface School {
  id: string;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function RelatoriosPage() {
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [schoolId, setSchoolId] = useState(searchParams.get('schoolId') || '');
  const [year, setYear] = useState(Number(searchParams.get('year')) || CURRENT_YEAR);

  const effectiveSchoolId = user?.role === 'SUPER_ADMIN' ? schoolId : (user?.schoolId ?? '');

  const { data: schools } = useQuery({
    queryKey: ['schools'],
    queryFn: () => fetchWithAuth<School[]>('/schools'),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['reports', 'alerts', effectiveSchoolId, year],
    queryFn: () => getAlerts(effectiveSchoolId, year),
    enabled: !!effectiveSchoolId,
  });

  const notifyMutation = useMutation({
    mutationFn: notifyConselhoTutelar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports', 'alerts', effectiveSchoolId, year] }),
  });

  useEffect(() => {
    const sid = searchParams.get('schoolId');
    const y = searchParams.get('year');
    if (sid) setSchoolId(sid);
    if (y) setYear(Number(y));
  }, [searchParams]);

  if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN_ESCOLAR') {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Acesso restrito a gestores.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h2 className="text-2xl font-semibold mb-6">Relatórios LDB</h2>

      <div className="flex flex-wrap gap-4 mb-6 items-end">
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
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href={`/relatorios/recuperacao?schoolId=${effectiveSchoolId}&year=${year}`}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Ver alunos em recuperação
          </Link>
          <Link
            href={`/relatorios/diario?schoolId=${effectiveSchoolId}&year=${year}`}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Relatório do diário de classe
          </Link>
        </div>
      </div>

      {!effectiveSchoolId && <p className="text-muted-foreground">Selecione uma escola.</p>}
      {effectiveSchoolId && isLoading && <p className="text-muted-foreground">Carregando...</p>}

      {effectiveSchoolId && alerts && (
        <div className="space-y-8">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium mb-3">Alunos com frequência abaixo de 75% (LDB Art. 24)</h3>
            {alerts.lowFrequency.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aluno com frequência abaixo do mínimo no ano selecionado.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.lowFrequency.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                    <div>
                      <span className="font-medium">{item.student.name}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {item.series} – {item.year}
                        {item.avgFrequency != null && (
                          <span className="ml-2 text-amber-600">({item.avgFrequency.toFixed(1)}% freq.)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.conselhoTutelarNotifiedAt ? (
                        <span className="text-sm text-green-600">Notificação registrada</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => notifyMutation.mutate(item.id)}
                          disabled={notifyMutation.isPending}
                          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          Registrar notificação CT
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium mb-3">Pendentes de notificação ao Conselho Tutelar</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Alunos com frequência &lt; 75% que ainda não tiveram a notificação registrada.
            </p>
            {alerts.conselhoTutelar.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pendente.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.conselhoTutelar.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                    <span className="font-medium">{item.student.name}</span>
                    <span className="text-muted-foreground text-sm">{item.series} – {item.year}</span>
                    <button
                      type="button"
                      onClick={() => notifyMutation.mutate(item.id)}
                      disabled={notifyMutation.isPending}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Registrar notificação
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
