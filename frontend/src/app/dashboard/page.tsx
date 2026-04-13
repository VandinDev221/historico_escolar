'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth, getYearConfig, upsertYearConfig, getPromotionRule, upsertPromotionRule } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface School {
  id: string;
  name: string;
  code: string | null;
  municipality: { name: string; state: string };
}

interface DashboardStats {
  year: number;
  schoolId: string;
  totalMatriculas: number;
  porSituacao: Record<string, number>;
  porSerie: Record<string, number>;
  porBairro: Record<string, number>;
  evasaoPercent: number;
  conclusaoPercent: number;
  aprovacaoPercent: number;
  reprovacaoPercent: number;
}

const SITUACAO_COLORS: Record<string, string> = {
  CURSANDO: '#22c55e',
  CONCLUIDO: '#3b82f6',
  TRANSFERIDO: '#f59e0b',
  EVADIDO: '#ef4444',
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 6 + i); // ex.: 2020 a 2029

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [schoolId, setSchoolId] = useState<string>('');
  const [year, setYear] = useState<number>(Math.max(2022, CURRENT_YEAR - 2)); // 2024 ou ano com mais chance de ter dados
  const [daysLetivos, setDaysLetivos] = useState(200);
  const [cargaHorariaAnual, setCargaHorariaAnual] = useState(800);
  const [minScore, setMinScore] = useState(6);
  const [minFreq, setMinFreq] = useState(75);
  const [useRecovery, setUseRecovery] = useState(true);

  const { data: schools } = useQuery({
    queryKey: ['schools'],
    queryFn: () => fetchWithAuth<School[]>('/schools'),
    enabled: user?.role !== 'PAIS_RESPONSAVEL',
  });

  const effectiveSchoolId = user?.role === 'SUPER_ADMIN' ? schoolId : user?.schoolId ?? '';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['reports', 'dashboard', effectiveSchoolId, year],
    queryFn: () =>
      fetchWithAuth<DashboardStats>(
        `/reports/dashboard?schoolId=${encodeURIComponent(effectiveSchoolId)}&year=${year}`
      ),
    enabled: !!effectiveSchoolId,
  });

  const { data: exportResponse } = useQuery({
    queryKey: ['reports', 'export', effectiveSchoolId, year],
    queryFn: () =>
      fetchWithAuth<{ items: Record<string, unknown>[]; total: number; page: number; totalPages: number }>(
        `/reports/export?schoolId=${encodeURIComponent(effectiveSchoolId)}&year=${year}&limit=2000`
      ),
    enabled: !!effectiveSchoolId,
  });

  const isGestor = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_ESCOLAR';
  const { data: yearConfig } = useQuery({
    queryKey: ['yearConfig', effectiveSchoolId, year],
    queryFn: () => getYearConfig(effectiveSchoolId, year),
    enabled: !!effectiveSchoolId && isGestor,
  });

  const upsertYearConfigMutation = useMutation({
    mutationFn: () => upsertYearConfig(effectiveSchoolId, year, { daysLetivos, cargaHorariaAnual }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['yearConfig', effectiveSchoolId, year] }),
  });

  const { data: promotionRule } = useQuery({
    queryKey: ['promotionRule', effectiveSchoolId, year],
    queryFn: () => getPromotionRule(effectiveSchoolId, year),
    enabled: !!effectiveSchoolId && isGestor,
  });

  const upsertPromotionMutation = useMutation({
    mutationFn: () => upsertPromotionRule(effectiveSchoolId, { year, minScore, minFrequencyPercent: minFreq, useRecoveryScore: useRecovery }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotionRule', effectiveSchoolId, year] }),
  });

  useEffect(() => {
    if (yearConfig) {
      setDaysLetivos(yearConfig.daysLetivos);
      setCargaHorariaAnual(yearConfig.cargaHorariaAnual);
    }
  }, [yearConfig?.daysLetivos, yearConfig?.cargaHorariaAnual]);

  useEffect(() => {
    if (promotionRule) {
      setMinScore(promotionRule.minScore);
      setMinFreq(promotionRule.minFrequencyPercent);
      setUseRecovery(promotionRule.useRecoveryScore);
    }
  }, [promotionRule?.minScore, promotionRule?.minFrequencyPercent, promotionRule?.useRecoveryScore]);

  const exportData = exportResponse?.items ?? [];

  const pieData = stats
    ? Object.entries(stats.porSituacao)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    : [];

  const barData = stats
    ? Object.entries(stats.porSerie).map(([name, value]) => ({ serie: name, total: value }))
    : [];
  const bairroData = stats?.porBairro
    ? Object.entries(stats.porBairro).map(([name, value]) => ({ bairro: name, total: value }))
    : [];

  const handleExportCsv = () => {
    if (!exportData?.length) return;
    const headers = ['serie', 'situacao', 'nomeAluno', 'dataNascimento', 'cpf'];
    const row = (o: Record<string, unknown>) =>
      headers.map((h) => (o[h] instanceof Date ? (o[h] as Date).toISOString().slice(0, 10) : String(o[h] ?? '')));
    const csv = [headers.join(';'), ...exportData.map((r) => row(r).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matriculas_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (user?.role === 'PAIS_RESPONSAVEL') {
    return (
      <AppLayout>
        <h2 className="text-2xl font-semibold mb-6">Dashboard gerencial</h2>
        <p className="text-muted-foreground">
          O dashboard é disponibilizado apenas para gestores e professores. Entre em contato com a secretaria da escola para informações sobre seu filho.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h2 className="text-2xl font-semibold mb-6">Dashboard gerencial</h2>

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
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
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
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {effectiveSchoolId && exportData.length > 0 && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Exportar CSV
              </button>
            </div>
          )}
        </div>

        {isGestor && effectiveSchoolId && (
          <div className="rounded-lg border bg-card p-4 mb-6">
            <h3 className="font-medium mb-3">Configuração do ano letivo (LDB)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Dias letivos mínimos: 200. Carga horária: 800h (EF) ou 1000h (EM).
            </p>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Dias letivos</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={daysLetivos}
                  onChange={(e) => setDaysLetivos(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-3 py-2 w-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Carga horária anual (h)</label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={cargaHorariaAnual}
                  onChange={(e) => setCargaHorariaAnual(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-3 py-2 w-28"
                />
              </div>
              <button
                type="button"
                onClick={() => upsertYearConfigMutation.mutate()}
                disabled={upsertYearConfigMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {upsertYearConfigMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {isGestor && effectiveSchoolId && (
          <div className="rounded-lg border bg-card p-4 mb-6">
            <h3 className="font-medium mb-3">Regras de promoção/retenção</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Critérios para aprovação na conclusão (nota mínima, frequência mínima %, considerar recuperação).
            </p>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Nota mínima</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="rounded border px-3 py-2 w-20"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Frequência mín. (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minFreq}
                  onChange={(e) => setMinFreq(Number(e.target.value))}
                  className="rounded border px-3 py-2 w-20"
                />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={useRecovery} onChange={(e) => setUseRecovery(e.target.checked)} />
                <span className="text-sm">Considerar nota de recuperação</span>
              </label>
              <button
                type="button"
                onClick={() => upsertPromotionMutation.mutate()}
                disabled={upsertPromotionMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {upsertPromotionMutation.isPending ? 'Salvando...' : 'Salvar regras'}
              </button>
            </div>
          </div>
        )}

        {!effectiveSchoolId && (
          <p className="text-muted-foreground">Selecione uma escola para ver o dashboard.</p>
        )}

        {effectiveSchoolId && isLoading && (
          <p className="text-muted-foreground">Carregando...</p>
        )}

        {effectiveSchoolId && stats && !isLoading && stats.totalMatriculas === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 mb-6">
            <p className="text-amber-800 dark:text-amber-200 font-medium">Nenhuma matrícula para o ano {year}</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Selecione outro ano letivo (ex.: 2022, 2023 ou 2024) para ver os dados.
            </p>
          </div>
        )}

        {effectiveSchoolId && stats && !isLoading && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total de matrículas</p>
                <p className="text-2xl font-semibold">{stats.totalMatriculas}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Conclusão (%)</p>
                <p className="text-2xl font-semibold text-blue-600">{stats.conclusaoPercent}%</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Evasão (%)</p>
                <p className="text-2xl font-semibold text-red-600">{stats.evasaoPercent}%</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Aprovação (%)</p>
                <p className="text-2xl font-semibold text-green-600">{stats.aprovacaoPercent}%</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Reprovação (%)</p>
                <p className="text-2xl font-semibold text-amber-600">{stats.reprovacaoPercent}%</p>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2 mb-8">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-medium mb-4">Situação das matrículas</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((e, i) => (
                          <Cell key={i} fill={SITUACAO_COLORS[e.name] ?? '#888'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhum dado para o ano selecionado.</p>
                )}
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-medium mb-4">Alunos por série</h3>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={barData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="serie" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" name="Alunos" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhum dado para o ano selecionado.</p>
                )}
              </div>
            </div>

            {isGestor && (
              <div className="rounded-lg border bg-card p-4 mb-6">
                <h3 className="font-medium mb-2">Relatórios LDB</h3>
                <div className="flex gap-3">
                  <Link
                    href={`/relatorios?schoolId=${effectiveSchoolId}&year=${year}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Alertas (frequência &lt; 75%, Conselho Tutelar)
                  </Link>
                  <span className="text-muted-foreground">|</span>
                  <Link
                    href={`/relatorios/recuperacao?schoolId=${effectiveSchoolId}&year=${year}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Alunos em recuperação
                  </Link>
                </div>
              </div>
            )}

            {bairroData.length > 0 && (
              <div className="rounded-lg border bg-card p-4 mb-8">
                <h3 className="font-medium mb-4">Alunos por bairro</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={bairroData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bairro" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="hsl(var(--primary))" name="Alunos" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
    </AppLayout>
  );
}
