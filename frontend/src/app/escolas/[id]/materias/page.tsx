'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { useAuthStore } from '@/store/auth';
import {
  fetchWithAuth,
  fetchGradeConfigsBySchool,
  createGradeConfig,
  updateGradeConfig,
  deleteGradeConfig,
  type GradeConfig,
  type CreateGradeConfigPayload,
} from '@/lib/api';

interface School {
  id: string;
  name: string;
}

const PASSOS = [
  {
    titulo: '1. Defina as séries',
    texto: 'Use o mesmo nome de série que você usa nas matrículas (ex.: "1º Ano", "2º Ano EF", "3º Ano"). Assim as disciplinas ficam vinculadas corretamente aos alunos.',
  },
  {
    titulo: '2. Cadastre cada disciplina',
    texto: 'Para cada matéria (ex.: Matemática, Português), informe o nome, a série em que é oferecida e a carga horária em horas. Não repita a mesma disciplina na mesma série.',
  },
  {
    titulo: '3. Vincule aos professores',
    texto: 'Depois de salvar as disciplinas, vá em Usuários (menu, se for Super Admin) ou peça ao Super Admin para vincular cada professor às disciplinas que ele leciona. O professor também pode cadastrar suas disciplinas em Meu perfil.',
  },
  {
    titulo: '4. Use nas matrículas',
    texto: 'Ao lançar notas dos alunos, o sistema usará automaticamente as disciplinas cadastradas aqui para a série da matrícula.',
  },
];

export default function MateriasPage() {
  const params = useParams();
  const schoolId = params.id as string;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const isGestor = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_ESCOLAR';

  const [series, setSeries] = useState('');
  const [subject, setSubject] = useState('');
  const [workload, setWorkload] = useState<number>(80);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editWorkload, setEditWorkload] = useState(80);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => fetchWithAuth<School>(`/schools/${schoolId}`),
    enabled: !!schoolId,
  });

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['gradeConfigsBySchool', schoolId],
    queryFn: () => fetchGradeConfigsBySchool(schoolId),
    enabled: !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateGradeConfigPayload) => createGradeConfig(schoolId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradeConfigsBySchool', schoolId] });
      setSeries('');
      setSubject('');
      setWorkload(80);
      setError(null);
      setMessage('Disciplina cadastrada com sucesso.');
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { subject?: string; workload?: number } }) =>
      updateGradeConfig(schoolId, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradeConfigsBySchool', schoolId] });
      setEditingId(null);
      setError(null);
      setMessage('Disciplina atualizada.');
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGradeConfig(schoolId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradeConfigsBySchool', schoolId] });
      setError(null);
      setMessage('Disciplina removida.');
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!series.trim() || !subject.trim()) {
      setError('Preencha série e nome da disciplina.');
      return;
    }
    createMutation.mutate({ series: series.trim(), subject: subject.trim(), workload });
  };

  const handleStartEdit = (c: GradeConfig) => {
    setEditingId(c.id);
    setEditSubject(c.subject);
    setEditWorkload(c.workload);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      payload: { subject: editSubject.trim() || undefined, workload: editWorkload },
    });
  };

  const bySeries = configs.reduce<Record<string, GradeConfig[]>>((acc, c) => {
    if (!acc[c.series]) acc[c.series] = [];
    acc[c.series].push(c);
    return acc;
  }, {});

  const seriesOrder = Object.keys(bySeries).sort();

  if (!schoolId) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Escola não informada.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <p className="mb-4">
        <Link href="/escolas" className="text-primary hover:underline">← Escolas</Link>
      </p>

      <h2 className="text-2xl font-semibold mb-2">
        Disciplinas / Matérias{school?.name ? ` — ${school.name}` : ''}
      </h2>
      <p className="text-muted-foreground text-sm mb-6">
        Cadastre as disciplinas por série para que os professores possam ser vinculados e as notas lançadas.
      </p>

      {/* Passo a passo */}
      <section className="rounded-lg border bg-card p-6 mb-8">
        <h3 className="font-medium mb-4">Como cadastrar as matérias</h3>
        <ol className="space-y-4">
          {PASSOS.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm font-medium flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-sm">{p.titulo}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {message && (
        <div className="mb-4 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm p-3">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {/* Formulário de criação — apenas gestor */}
      {isGestor && (
        <section className="rounded-lg border bg-card p-6 mb-8">
          <h3 className="font-medium mb-4">Nova disciplina</h3>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[140px]">
              <label className="block text-sm font-medium mb-1">Série *</label>
              <input
                type="text"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                placeholder="Ex.: 1º Ano"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium mb-1">Disciplina *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex.: Matemática"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium mb-1">Carga (h)</label>
              <input
                type="number"
                min={1}
                value={workload}
                onChange={(e) => setWorkload(Number(e.target.value) || 80)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Salvando...' : 'Cadastrar'}
            </button>
          </form>
        </section>
      )}

      {/* Lista por série */}
      <section className="rounded-lg border bg-card p-6">
        <h3 className="font-medium mb-4">Disciplinas cadastradas</h3>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : seriesOrder.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma disciplina cadastrada ainda. Use o formulário acima para cadastrar.
          </p>
        ) : (
          <div className="space-y-6">
            {seriesOrder.map((serie) => (
              <div key={serie}>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">{serie}</h4>
                <ul className="space-y-2">
                  {bySeries[serie].map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      {editingId === c.id && isGestor ? (
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            className="flex-1 min-w-[120px] rounded border px-2 py-1"
                          />
                          <input
                            type="number"
                            min={1}
                            value={editWorkload}
                            onChange={(e) => setEditWorkload(Number(e.target.value) || 80)}
                            className="w-16 rounded border px-2 py-1"
                          />
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={updateMutation.isPending}
                            className="text-primary hover:underline"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-muted-foreground hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <span>
                            <strong>{c.subject}</strong>
                            <span className="ml-2 text-muted-foreground">{c.workload}h</span>
                          </span>
                          {isGestor && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(c)}
                                className="text-primary hover:underline text-sm"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Remover esta disciplina? Isso pode afetar notas já lançadas.')) {
                                    deleteMutation.mutate(c.id);
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                className="text-destructive hover:underline text-sm"
                              >
                                Excluir
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}
