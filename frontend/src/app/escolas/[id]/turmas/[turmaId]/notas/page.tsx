'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import {
  getTurma,
  fetchGradeConfigs,
  getGradesBulkByTurma,
  upsertGradesBulk,
  type GradeConfig,
} from '@/lib/api';

/** Converte frequência para porcentagem (0-100%). Escala 0-40: 40=100%. Valores >40 tratados como % e limitados a 100%. */
function freqToPercent(value: string | number | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (Number.isNaN(n)) return '—';
  const percent = n <= 40 ? (n / 40) * 100 : Math.min(100, n);
  return `${percent.toFixed(1)}%`;
}

/** Retorna totais de presença/faltas do item (aceita camelCase ou snake_case da API). */
function getAttendanceNumbers(item: Record<string, unknown>) {
  const presencas = item.totalPresencas ?? item.total_presencas;
  const faltas = item.totalFaltas ?? item.total_faltas;
  const justif = item.faltasJustificadas ?? item.faltas_justificadas;
  return {
    totalPresencas: typeof presencas === 'number' ? presencas : 0,
    totalFaltas: typeof faltas === 'number' ? faltas : 0,
    faltasJustificadas: typeof justif === 'number' ? justif : 0,
  };
}

function calcFrequencyFromAttendance(totalPresencas: number, totalFaltas: number) {
  const total = (totalPresencas ?? 0) + (totalFaltas ?? 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const raw40 = (totalPresencas / total) * 40;
  const percent = (totalPresencas / total) * 100;
  return {
    raw40: Math.round(raw40 * 100) / 100, // 2 casas
    percentText: `${percent.toFixed(1)}%`,
  };
}

export default function NotasTurmaPage() {
  const params = useParams();
  const schoolId = params.id as string;
  const turmaId = params.turmaId as string;
  const queryClient = useQueryClient();
  const [gradeConfigId, setGradeConfigId] = useState('');
  const [bimester, setBimester] = useState(1);
  const [rows, setRows] = useState<Record<string, { score1: string; score2: string; score3: string; score4: string; frequency: string }>>({});
  const [isEditingTurma, setIsEditingTurma] = useState(false);

  const { data: turma, isLoading: loadingTurma } = useQuery({
    queryKey: ['turma', schoolId, turmaId],
    queryFn: () => getTurma(schoolId, turmaId),
    enabled: !!schoolId && !!turmaId,
  });

  const { data: configs } = useQuery({
    queryKey: ['grade-configs', schoolId, turma?.series],
    queryFn: () => fetchGradeConfigs(schoolId, turma!.series),
    enabled: !!schoolId && !!turma?.series,
  });

  const { data: bulkItems, isLoading: loadingBulk } = useQuery({
    queryKey: ['grades-bulk', schoolId, turmaId, gradeConfigId, bimester],
    queryFn: () => getGradesBulkByTurma(schoolId, turmaId, gradeConfigId, bimester),
    enabled: !!schoolId && !!turmaId && !!gradeConfigId,
  });

  const rowsWithDefaults = useMemo(() => {
    if (!bulkItems?.length) return [];
    return bulkItems.map((item) => ({
      ...item,
      score1: rows[item.enrollmentId]?.score1 ?? (item.score1 != null ? String(item.score1) : ''),
      score2: rows[item.enrollmentId]?.score2 ?? (item.score2 != null ? String(item.score2) : ''),
      score3: rows[item.enrollmentId]?.score3 ?? (item.score3 != null ? String(item.score3) : ''),
      score4: rows[item.enrollmentId]?.score4 ?? (item.score4 != null ? String(item.score4) : ''),
      frequency: rows[item.enrollmentId]?.frequency ?? (item.frequency != null ? String(item.frequency) : ''),
    }));
  }, [bulkItems, rows]);

  const updateCell = (
    enrollmentId: string,
    field: 'score1' | 'score2' | 'score3' | 'score4' | 'frequency',
    value: string
  ) => {
    setRows((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        [field]: value,
      },
    }));
  };

  /** Média das 4 notas (apenas das preenchidas) para exibição */
  const calcMedia = (s1: string, s2: string, s3: string, s4: string): number | null => {
    const vals = [s1, s2, s3, s4].map((s) => parseNota(s)).filter((n): n is number => n !== undefined);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  };

  const parseNota = (s: string): number | undefined => {
    const t = (s ?? '').trim().replace(',', '.');
    if (t === '') return undefined;
    const n = parseFloat(t);
    return Number.isNaN(n) ? undefined : n;
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const grades = rowsWithDefaults.map((r) => {
        const s1 = parseNota(r.score1);
        const s2 = parseNota(r.score2);
        const s3 = parseNota(r.score3);
        const s4 = parseNota(r.score4);
        const att = getAttendanceNumbers(r as unknown as Record<string, unknown>);
        const calc = calcFrequencyFromAttendance(att.totalPresencas, att.totalFaltas);
        const freq = calc ? calc.raw40 : parseNota(r.frequency);
        return {
          enrollmentId: r.enrollmentId,
          ...(s1 !== undefined && { score1: s1 }),
          ...(s2 !== undefined && { score2: s2 }),
          ...(s3 !== undefined && { score3: s3 }),
          ...(s4 !== undefined && { score4: s4 }),
          ...(freq !== undefined && { frequency: freq }),
        };
      }).filter(
        (g) =>
          g.score1 !== undefined ||
          g.score2 !== undefined ||
          g.score3 !== undefined ||
          g.score4 !== undefined ||
          g.frequency !== undefined
      );
      return upsertGradesBulk(schoolId, turmaId, {
        gradeConfigId,
        bimester,
        grades,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades-bulk', schoolId, turmaId, gradeConfigId, bimester] });
      setIsEditingTurma(false);
    },
  });

  const hasAnyValue = useMemo(() => {
    return rowsWithDefaults.some((r) => {
      const att = getAttendanceNumbers(r as unknown as Record<string, unknown>);
      const calc = calcFrequencyFromAttendance(att.totalPresencas, att.totalFaltas);
      return (
        parseNota(r.score1) !== undefined ||
        parseNota(r.score2) !== undefined ||
        parseNota(r.score3) !== undefined ||
        parseNota(r.score4) !== undefined ||
        calc != null ||
        parseNota(r.frequency) !== undefined
      );
    });
  }, [rowsWithDefaults]);

  if (loadingTurma || !turma) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Carregando...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <p className="mb-4">
        <Link href={`/escolas/${schoolId}/turmas`} className="text-primary hover:underline">
          ← Voltar às turmas
        </Link>
      </p>
      <h2 className="text-2xl font-semibold mb-2">Lançar notas — turma</h2>
      <p className="text-muted-foreground text-sm mb-4">
        {turma.name} — {turma.series} — {turma.year}
      </p>

      <div className="flex flex-wrap gap-4 items-end mb-6">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Disciplina</label>
          <select
            value={gradeConfigId}
            onChange={(e) => {
              setGradeConfigId(e.target.value);
              setRows({});
              setIsEditingTurma(false);
            }}
            className="rounded border px-3 py-2 min-w-[180px]"
          >
            <option value="">Selecione a disciplina</option>
            {(configs ?? []).map((c: GradeConfig) => (
              <option key={c.id} value={c.id}>
                {c.subject}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Bimestre</label>
          <select
            value={bimester}
            onChange={(e) => {
              setBimester(Number(e.target.value));
              setRows({});
              setIsEditingTurma(false);
            }}
            className="rounded border px-3 py-2"
          >
            {[1, 2, 3, 4].map((b) => (
              <option key={b} value={b}>
                {b}º bimestre
              </option>
            ))}
          </select>
        </div>
      </div>

      {!gradeConfigId && (
        <p className="text-muted-foreground">Selecione uma disciplina para lançar as notas de todos os alunos da turma de uma vez.</p>
      )}

      {turma && configs && configs.length === 0 && (
        <p className="text-amber-700 dark:text-amber-400 text-sm mt-2">
          Nenhuma disciplina disponível para esta turma (série: {turma.series}). Se você é professor, verifique no seu perfil se está vinculado a disciplinas desta mesma série.
        </p>
      )}

      {gradeConfigId && loadingBulk && <p className="text-muted-foreground">Carregando alunos...</p>}

      {gradeConfigId && !loadingBulk && bulkItems && bulkItems.length === 0 && (
        <p className="text-muted-foreground">Nenhum aluno vinculado a esta turma. Vincule matrículas à turma em Alunos.</p>
      )}

      {gradeConfigId && !loadingBulk && bulkItems && bulkItems.length > 0 && (
        <>
          {!isEditingTurma ? (
            <>
              <p className="text-muted-foreground text-sm mb-3">
                Notas da turma (somente leitura). Clique em &quot;Editar notas da turma&quot; para lançar ou alterar.
              </p>
              {rowsWithDefaults.every((r) => {
                const a = getAttendanceNumbers(r as Record<string, unknown>);
                return a.totalPresencas === 0 && a.totalFaltas === 0;
              }) && (
                <p className="text-amber-700 dark:text-amber-400 text-sm mb-3">
                  Presenças e faltas vêm do <strong>Diário de classe</strong>. Lance os dias letivos no diário (por data) para os totais aparecerem aqui.
                </p>
              )}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setIsEditingTurma(true)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Editar notas da turma
                </button>
              </div>
              <div className="rounded-lg border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Aluno</th>
                      <th className="p-3 font-medium w-20 text-center">N1</th>
                      <th className="p-3 font-medium w-20 text-center">N2</th>
                      <th className="p-3 font-medium w-20 text-center">N3</th>
                      <th className="p-3 font-medium w-20 text-center">N4</th>
                      <th className="p-3 font-medium w-20 text-center">Média</th>
                      <th className="p-3 font-medium w-28">Freq. %</th>
                      <th className="p-3 font-medium w-24 text-center">Presenças</th>
                      <th className="p-3 font-medium w-24 text-center">Faltas</th>
                      <th className="p-3 font-medium w-24 text-center">Faltas justif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsWithDefaults.map((item) => {
                      const att = getAttendanceNumbers(item as Record<string, unknown>);
                      const calc = calcFrequencyFromAttendance(att.totalPresencas, att.totalFaltas);
                      const media = calcMedia(item.score1, item.score2, item.score3, item.score4);
                      return (
                        <tr key={item.enrollmentId} className="border-b last:border-0">
                          <td className="p-3 font-medium">{item.studentName}</td>
                          <td className="p-3 text-center text-muted-foreground">{item.score1 || '—'}</td>
                          <td className="p-3 text-center text-muted-foreground">{item.score2 || '—'}</td>
                          <td className="p-3 text-center text-muted-foreground">{item.score3 || '—'}</td>
                          <td className="p-3 text-center text-muted-foreground">{item.score4 || '—'}</td>
                          <td className="p-3 text-center font-medium">{media ?? (item.score ?? '—')}</td>
                          <td className="p-3 text-center text-muted-foreground">
                            {calc ? calc.percentText : freqToPercent(item.frequency)}
                          </td>
                          <td className="p-3 text-center text-muted-foreground">{att.totalPresencas}</td>
                          <td className="p-3 text-center text-muted-foreground">{att.totalFaltas}</td>
                          <td className="p-3 text-center text-muted-foreground">{att.faltasJustificadas}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm mb-3">
            Edite os campos e clique em Salvar para gravar. Cancelar volta à visualização sem alterar nada.
          </p>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Aluno</th>
                  <th className="p-2 font-medium w-20 text-center">N1</th>
                  <th className="p-2 font-medium w-20 text-center">N2</th>
                  <th className="p-2 font-medium w-20 text-center">N3</th>
                  <th className="p-2 font-medium w-20 text-center">N4</th>
                  <th className="p-2 font-medium w-20 text-center">Média</th>
                  <th className="p-3 font-medium w-28">Freq. %</th>
                  <th className="p-3 font-medium w-24 text-center">Presenças</th>
                  <th className="p-3 font-medium w-24 text-center">Faltas</th>
                  <th className="p-3 font-medium w-24 text-center">Faltas justif.</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithDefaults.map((item) => {
                  const att = getAttendanceNumbers(item as Record<string, unknown>);
                  const calc = calcFrequencyFromAttendance(att.totalPresencas, att.totalFaltas);
                  const media = calcMedia(item.score1, item.score2, item.score3, item.score4);
                  return (
                    <tr key={item.enrollmentId} className="border-b last:border-0">
                      <td className="p-3 font-medium">{item.studentName}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0–10"
                          value={item.score1}
                          onChange={(e) => updateCell(item.enrollmentId, 'score1', e.target.value)}
                          className="w-14 rounded border px-2 py-1.5 text-center"
                          title="Nota 1 (0 a 10)"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0–10"
                          value={item.score2}
                          onChange={(e) => updateCell(item.enrollmentId, 'score2', e.target.value)}
                          className="w-14 rounded border px-2 py-1.5 text-center"
                          title="Nota 2 (0 a 10)"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0–10"
                          value={item.score3}
                          onChange={(e) => updateCell(item.enrollmentId, 'score3', e.target.value)}
                          className="w-14 rounded border px-2 py-1.5 text-center"
                          title="Nota 3 (0 a 10)"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0–10"
                          value={item.score4}
                          onChange={(e) => updateCell(item.enrollmentId, 'score4', e.target.value)}
                          className="w-14 rounded border px-2 py-1.5 text-center"
                          title="Nota 4 (0 a 10)"
                        />
                      </td>
                      <td className="p-3 text-center font-medium tabular-nums">{media ?? '—'}</td>
                      <td className="p-2">
                        {calc ? (
                          <span className="inline-block w-20 text-center text-muted-foreground" title="Calculada por presenças e faltas (Diário de classe)">
                            {calc.percentText}
                          </span>
                        ) : (
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0–40"
                            value={item.frequency}
                            onChange={(e) => updateCell(item.enrollmentId, 'frequency', e.target.value)}
                            className="w-20 rounded border px-2 py-1.5 text-center"
                            title="Sem diário lançado: digite a frequência (0 a 40)"
                          />
                        )}
                      </td>
                      <td className="p-3 text-center text-muted-foreground">{att.totalPresencas}</td>
                      <td className="p-3 text-center text-muted-foreground">{att.totalFaltas}</td>
                      <td className="p-3 text-center text-muted-foreground">{att.faltasJustificadas}</td>
                    </tr>
                  );
                })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={!hasAnyValue || saveMutation.isPending}
                  className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar / Atualizar notas'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTurma(false)}
                  className="rounded border px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                {saveMutation.isError && (
                  <span className="text-sm text-destructive">
                    {(saveMutation.error as Error).message}
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}
    </AppLayout>
  );
}
