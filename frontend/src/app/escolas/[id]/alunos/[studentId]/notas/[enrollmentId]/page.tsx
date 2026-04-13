'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import {
  fetchWithAuth,
  fetchGradeConfigs,
  fetchGrades,
  upsertGrade,
  type Grade,
  type GradeConfig,
  type UpsertGradePayload,
} from '@/lib/api';

interface Enrollment {
  id: string;
  year: number;
  series: string;
  situation: string;
}

type CellValues = Record<string, { score: string; freq: string }>;
type CellEditable = Record<string, boolean>;

function buildCellValues(configs: GradeConfig[] | undefined, grades: Grade[] | undefined): CellValues {
  const out: CellValues = {};
  if (!configs) return out;
  for (const config of configs) {
    for (const bim of [1, 2, 3, 4] as const) {
      const key = `${config.id}-${bim}`;
      const g = grades?.find((x) => x.gradeConfigId === config.id && x.bimester === bim);
      out[key] = {
        score: g?.score != null ? String(g.score) : '',
        freq: g?.frequency != null ? String(g.frequency) : '',
      };
    }
  }
  return out;
}

function buildCellEditable(configs: GradeConfig[] | undefined): CellEditable {
  const out: CellEditable = {};
  if (!configs) return out;
  for (const config of configs) {
    for (const bim of [1, 2, 3, 4] as const) {
      const key = `${config.id}-${bim}`;
      out[key] = true; // Professor e admin podem sempre editar/alterar as notas
    }
  }
  return out;
}

export default function NotasPage() {
  const params = useParams();
  const schoolId = params.id as string;
  const studentId = params.studentId as string;
  const enrollmentId = params.enrollmentId as string;
  const queryClient = useQueryClient();
  const [cellValues, setCellValues] = useState<CellValues>({});
  const [saving, setSaving] = useState(false);
  const [cellEditable, setCellEditable] = useState<CellEditable>({});

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', studentId],
    queryFn: () =>
      fetchWithAuth<Enrollment[]>(
        `/schools/${schoolId}/students/${studentId}/enrollments`
      ),
    enabled: !!schoolId && !!studentId,
  });

  const enrollment = enrollments?.find((e) => e.id === enrollmentId);

  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ['grade-configs', schoolId, enrollment?.series],
    queryFn: () => fetchGradeConfigs(schoolId, enrollment!.series),
    enabled: !!schoolId && !!enrollment?.series,
  });

  const { data: grades, isLoading: loadingGrades } = useQuery({
    queryKey: ['grades', enrollmentId],
    queryFn: () => fetchGrades(enrollmentId),
    enabled: !!enrollmentId,
  });

  const initialValues = useMemo(() => buildCellValues(configs, grades), [configs, grades]);
  const initialEditable = useMemo(() => buildCellEditable(configs), [configs]);
  useEffect(() => {
    setCellValues(initialValues);
    setCellEditable(initialEditable);
  }, [initialValues, initialEditable]);

  const updateCell = (key: string, field: 'score' | 'freq', value: string) => {
    setCellValues((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    // Se o usuário alterou o valor, considera a célula como editável
    setCellEditable((prev) => ({
      ...prev,
      [key]: true,
    }));
  };

  const parseNota = (s: string): number | undefined => {
    const t = (s ?? '').trim().replace(',', '.');
    if (t === '') return undefined;
    const n = parseFloat(t);
    return Number.isNaN(n) ? undefined : n;
  };

  const hasAnyValue = useMemo(() => {
    return Object.values(cellValues).some(
      (c) => parseNota(c.score) !== undefined || parseNota(c.freq) !== undefined
    );
  }, [cellValues]);

  const handleSaveAll = async () => {
    if (!configs) return;
    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [];
      for (const config of configs) {
        for (const bim of [1, 2, 3, 4] as const) {
          const key = `${config.id}-${bim}`;
          const cell = cellValues[key];
          if (!cell) continue;
          const s = parseNota(cell.score);
          const f = parseNota(cell.freq);
          if (s === undefined && f === undefined) continue;
          const payload: UpsertGradePayload = {
            bimester: bim,
            ...(s !== undefined && { score: s }),
            ...(f !== undefined && { frequency: f }),
          };
          promises.push(upsertGrade(enrollmentId, config.id, payload));
        }
      }
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ['grades', enrollmentId] });
    } finally {
      setSaving(false);
    }
  };

  if (!enrollment) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Carregando...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <p className="mb-4">
        <Link
          href={`/escolas/${schoolId}/alunos/${studentId}`}
          className="text-primary hover:underline"
        >
          ← Voltar ao aluno
        </Link>
      </p>
      <h2 className="text-2xl font-semibold mb-2">Lançamento de notas</h2>
      <p className="text-muted-foreground text-sm mb-6">
        {enrollment.year} — {enrollment.series} — {enrollment.situation}
      </p>

      {loadingConfigs || loadingGrades ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !configs?.length ? (
        <p className="text-muted-foreground">
          Nenhuma disciplina configurada para esta série. Configure as disciplinas
          na escola para lançar notas.
        </p>
      ) : (
        <>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Disciplina</th>
                  <th className="p-2 font-medium">B1 (Nota / Freq.)</th>
                  <th className="p-2 font-medium">B2 (Nota / Freq.)</th>
                  <th className="p-2 font-medium">B3 (Nota / Freq.)</th>
                  <th className="p-2 font-medium">B4 (Nota / Freq.)</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => (
                  <tr key={config.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{config.subject}</td>
                    {([1, 2, 3, 4] as const).map((bim) => {
                      const key = `${config.id}-${bim}`;
                      const cell = cellValues[key] ?? { score: '', freq: '' };
                      const editable = cellEditable[key] ?? true;
                      return (
                        <td key={bim} className="p-2">
                          <GradeCell
                            score={cell.score}
                            freq={cell.freq}
                            editable={editable}
                            onScoreChange={(v) => updateCell(key, 'score', v)}
                            onFreqChange={(v) => updateCell(key, 'freq', v)}
                            onEnableEdit={() =>
                              setCellEditable((prev) => ({
                                ...prev,
                                [key]: true,
                              }))
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!hasAnyValue || saving}
              className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </>
      )}
    </AppLayout>
  );
}

function GradeCell({
  score,
  freq,
  editable,
  onScoreChange,
  onFreqChange,
  onEnableEdit,
}: {
  score: string;
  freq: string;
  editable: boolean;
  onScoreChange: (value: string) => void;
  onFreqChange: (value: string) => void;
  onEnableEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <input
        type="number"
        min={0}
        max={10}
        step={0.1}
        placeholder="Nota"
        value={score}
        onChange={(e) => onScoreChange(e.target.value)}
        disabled={!editable}
        className="w-14 rounded border border-border px-1 py-0.5 text-center text-sm disabled:bg-muted/60 disabled:text-muted-foreground"
      />
      <input
        type="number"
        min={0}
        max={40}
        step={0.1}
        placeholder="Freq. (0-40)"
        value={freq}
        onChange={(e) => onFreqChange(e.target.value)}
        disabled={!editable}
        className="w-14 rounded border border-border px-1 py-0.5 text-center text-sm disabled:bg-muted/60 disabled:text-muted-foreground"
      />
      {!editable && (score || freq) && (
        <button
          type="button"
          onClick={onEnableEdit}
          className="mt-0.5 text-[11px] text-primary hover:underline self-start"
        >
          Editar
        </button>
      )}
    </div>
  );
}

