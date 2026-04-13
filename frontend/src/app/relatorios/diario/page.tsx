'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { useAuthStore } from '@/store/auth';
import { fetchWithAuth, fetchTurmas, getClassDiaryReport } from '@/lib/api';
import type { Turma } from '@/lib/api';

interface School {
  id: string;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function DiarioRelatorioPageContent() {
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [schoolId, setSchoolId] = useState(searchParams.get('schoolId') || '');
  const [year, setYear] = useState(Number(searchParams.get('year')) || CURRENT_YEAR);
  const [turmaId, setTurmaId] = useState(searchParams.get('turmaId') || '');

  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || today);
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || today);

  const effectiveSchoolId = user?.role === 'SUPER_ADMIN' ? schoolId : (user?.schoolId ?? '');

  const { data: schools } = useQuery({
    queryKey: ['schools'],
    queryFn: () => fetchWithAuth<School[]>('/schools'),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: turmas } = useQuery({
    queryKey: ['turmas', effectiveSchoolId, year],
    queryFn: () => fetchTurmas(effectiveSchoolId, year),
    enabled: !!effectiveSchoolId,
  });

  const canLoadReport =
    !!effectiveSchoolId && !!turmaId && !!startDate && !!endDate && startDate <= endDate;

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', 'diary', effectiveSchoolId, turmaId, startDate, endDate],
    queryFn: () => getClassDiaryReport(effectiveSchoolId, turmaId, startDate, endDate),
    enabled: canLoadReport,
  });

  const handleExportCsv = () => {
    if (!report) return;
    const headers = [
      'Aluno',
      'MatrículaId',
      'Presenças',
      'Faltas',
      'FaltasJustificadas',
      'FaltasInjustificadas',
      'FrequênciaPercent',
    ];
    const rows = report.students.map((s) => [
      s.studentName,
      s.enrollmentId,
      String(s.presencas),
      String(s.faltas),
      String(s.faltasJustificadas ?? 0),
      String(s.faltasInjustificadas ?? 0),
      s.frequencyPercent != null ? String(s.frequencyPercent) : '',
    ]);
    const csv =
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diario_turma_${report.turma.name}_${report.period.startDate}_${report.period.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <h2 className="text-2xl font-semibold">Relatório do diário de classe</h2>
        <Link href="/relatorios" className="text-sm text-primary hover:underline">
          ← Voltar aos relatórios
        </Link>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        {user?.role === 'SUPER_ADMIN' && (
          <div>
            <label className="block font-medium text-muted-foreground mb-1">Escola</label>
            <select
              value={schoolId}
              onChange={(e) => {
                setSchoolId(e.target.value);
                setTurmaId('');
              }}
              className="rounded-md border border-border bg-background px-3 py-2 min-w-[200px]"
            >
              <option value="">Selecione...</option>
              {schools?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block font-medium text-muted-foreground mb-1">Ano letivo</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium text-muted-foreground mb-1">Turma</label>
          <select
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 min-w-[180px]"
          >
            <option value="">Selecione...</option>
            {turmas?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.year} • {t.name} ({t.series}) {t.turno ? `- ${t.turno}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium text-muted-foreground mb-1">Data inicial</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium text-muted-foreground mb-1">Data final</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </div>
      </div>

      {!effectiveSchoolId && (
        <p className="text-muted-foreground">Selecione uma escola.</p>
      )}

      {effectiveSchoolId && !turmaId && (
        <p className="text-muted-foreground">Selecione uma turma.</p>
      )}

      {effectiveSchoolId && turmaId && startDate > endDate && (
        <p className="text-destructive text-sm">
          A data inicial não pode ser maior que a data final.
        </p>
      )}

      {canLoadReport && isLoading && (
        <p className="text-muted-foreground">Carregando relatório...</p>
      )}

      {canLoadReport && report && (
        <div className="rounded-lg border bg-card p-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm">
            <div>
              <div className="font-medium">
                {report.turma.name} – {report.turma.series} ({report.turma.year}){' '}
                {report.turma.turno && `– ${report.turma.turno}`}
              </div>
              <div className="text-muted-foreground">
                Período: {report.period.startDate} a {report.period.endDate}
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Exportar CSV
            </button>
          </div>

          {report.students.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum aluno com registros de chamada no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm border">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="p-2 text-left font-medium border-b">Aluno</th>
                    <th className="p-2 text-left font-medium border-b">Presenças</th>
                    <th className="p-2 text-left font-medium border-b">Faltas</th>
                    <th className="p-2 text-left font-medium border-b">Justif.</th>
                    <th className="p-2 text-left font-medium border-b">Injustif.</th>
                    <th className="p-2 text-left font-medium border-b">Freq. (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.students.map((s) => (
                    <tr key={s.enrollmentId} className="border-b last:border-b-0">
                      <td className="p-2">{s.studentName}</td>
                      <td className="p-2">{s.presencas}</td>
                      <td className="p-2">{s.faltas}</td>
                      <td className="p-2">{s.faltasJustificadas ?? 0}</td>
                      <td className="p-2">{s.faltasInjustificadas ?? 0}</td>
                      <td className="p-2">
                        {s.frequencyPercent != null ? s.frequencyPercent.toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}

export default function DiarioRelatorioPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <p className="text-muted-foreground">Carregando...</p>
        </AppLayout>
      }
    >
      <DiarioRelatorioPageContent />
    </Suspense>
  );
}
