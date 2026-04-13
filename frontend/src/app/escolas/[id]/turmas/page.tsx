'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { fetchWithAuth, fetchTurmas, createTurma, updateTurma, deleteTurma } from '@/lib/api';
import type { Turma, Turno, User } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface School {
  id: string;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const TURNOS: { value: Turno; label: string }[] = [
  { value: 'MANHA', label: 'Manhã' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'NOITE', label: 'Noite' },
  { value: 'INTEGRAL', label: 'Integral' },
];

export default function TurmasPage() {
  const params = useParams();
  const schoolId = params.id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user as User | null);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isGestor = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_ESCOLAR';
  const [year, setYear] = useState(CURRENT_YEAR);
  const [showForm, setShowForm] = useState(false);
  const [newSeries, setNewSeries] = useState('');
  const [newName, setNewName] = useState('');
  const [newTurno, setNewTurno] = useState<Turno | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSeries, setEditSeries] = useState('');
  const [editName, setEditName] = useState('');
  const [editTurno, setEditTurno] = useState<Turno | ''>('');

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => fetchWithAuth<School>(`/schools/${schoolId}`),
    enabled: !!schoolId,
  });

  const { data: turmas, isLoading } = useQuery({
    queryKey: ['turmas', schoolId, year],
    queryFn: () => fetchTurmas(schoolId, year),
    enabled: !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTurma(schoolId, {
        year,
        series: newSeries.trim(),
        name: newName.trim(),
        ...(newTurno && { turno: newTurno as Turno }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas', schoolId, year] });
      setShowForm(false);
      setNewSeries('');
      setNewName('');
      setNewTurno('');
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => fetchWithAuth<{ ok: boolean; message?: string; turmas?: Turma[] }>('/dev/seed-turmas', { method: 'POST' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['turmas', schoolId, year] });
      // opcionalmente poderíamos mostrar message em um toast; por enquanto só recarrega lista
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { turmaId: string; series?: string; name?: string; turno?: Turno | null }) =>
      updateTurma(schoolId, payload.turmaId, {
        series: payload.series,
        name: payload.name,
        turno: payload.turno ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas', schoolId, year] });
      setEditingId(null);
      setEditSeries('');
      setEditName('');
      setEditTurno('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (turmaId: string) => deleteTurma(schoolId, turmaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas', schoolId, year] });
    },
  });

  return (
    <AppLayout>
      <p className="mb-4">
        <Link href="/escolas" className="text-primary hover:underline">
          ← Voltar para escolas
        </Link>
      </p>
      <h2 className="text-2xl font-semibold mb-2">Turmas</h2>
      <p className="text-muted-foreground text-sm mb-6">
        {school?.name} — Ano letivo{' '}
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded border px-2 py-1"
        >
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </p>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      {isGestor && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 mb-4"
        >
          Nova turma
        </button>
      )}

      {isGestor && showForm && (
        <div className="rounded-lg border bg-card p-4 mb-6">
          <h3 className="font-medium mb-3">Criar turma</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Série</label>
              <input
                type="text"
                value={newSeries}
                onChange={(e) => setNewSeries(e.target.value)}
                placeholder="Ex.: 6º Ano"
                className="rounded border px-3 py-2 w-32"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Nome</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: 6ºA"
                className="rounded border px-3 py-2 w-24"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Turno</label>
              <select
                value={newTurno}
                onChange={(e) => setNewTurno(e.target.value as Turno | '')}
                className="rounded border px-3 py-2"
              >
                <option value="">—</option>
                {TURNOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!newSeries.trim() || !newName.trim() || createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Turma</th>
              <th className="text-left p-3 font-medium">Série</th>
              <th className="text-left p-3 font-medium">Turno</th>
              <th className="text-left p-3 font-medium">Alunos</th>
              <th className="text-left p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {turmas?.map((t) => {
              const isEditing = editingId === t.id;
              const currentTurnoLabel =
                t.turno ? TURNOS.find((x) => x.value === t.turno)?.label ?? t.turno : '—';
              return (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded border px-2 py-1 w-24"
                      />
                    ) : (
                      t.name
                    )}
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editSeries}
                        onChange={(e) => setEditSeries(e.target.value)}
                        className="rounded border px-2 py-1 w-32"
                      />
                    ) : (
                      t.series
                    )}
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <select
                        value={editTurno}
                        onChange={(e) => setEditTurno(e.target.value as Turno | '')}
                        className="rounded border px-2 py-1"
                      >
                        <option value="">—</option>
                        {TURNOS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      currentTurnoLabel
                    )}
                  </td>
                  <td className="p-3">{t._count?.enrollments ?? 0}</td>
                  <td className="p-3 flex flex-wrap gap-2 items-center">
                    <Link
                      href={`/escolas/${schoolId}/turmas/${t.id}/diario`}
                      className="text-primary hover:underline text-sm"
                    >
                      Diário de classe
                    </Link>
                    <Link
                      href={`/escolas/${schoolId}/turmas/${t.id}/notas`}
                      className="text-primary hover:underline text-sm"
                    >
                      Lançar notas
                    </Link>
                    {isGestor && !isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(t.id);
                            setEditSeries(t.series);
                            setEditName(t.name);
                            setEditTurno(t.turno ?? '');
                          }}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Excluir a turma ${t.name} (${t.series})? As matrículas continuarão existindo, apenas sem vínculo de turma.`,
                              )
                            ) {
                              deleteMutation.mutate(t.id);
                            }
                          }}
                          className="text-xs text-destructive hover:underline"
                          disabled={deleteMutation.isPending}
                        >
                          Excluir
                        </button>
                      </>
                    )}
                    {isGestor && isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              turmaId: t.id,
                              series: editSeries.trim() || t.series,
                              name: editName.trim() || t.name,
                              turno: (editTurno || null) as Turno | null,
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="text-xs text-primary hover:underline"
                        >
                          {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditSeries('');
                            setEditName('');
                            setEditTurno('');
                          }}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {turmas?.length === 0 && !isLoading && (
          <div className="p-4 text-sm text-muted-foreground space-y-3">
            <p>Nenhuma turma cadastrada para este ano.</p>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {seedMutation.isPending ? 'Gerando turmas de exemplo...' : 'Criar turmas de exemplo'}
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
