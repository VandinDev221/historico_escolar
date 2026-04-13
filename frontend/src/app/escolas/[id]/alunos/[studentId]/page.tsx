'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import {
  fetchWithAuth,
  fetchTurmas,
  createEnrollment,
  updateEnrollment,
  type Turma,
} from '@/lib/api';

interface StudentDetail {
  id: string;
  name: string;
  birthDate: string;
  rg: string | null;
  cpf: string | null;
  nis: string | null;
  address: string | null;
  schoolId: string;
  contacts: { name: string; phone: string | null; email: string | null }[];
  enrollments: {
    id: string;
    year: number;
    series: string;
    situation: string;
    turma?: { id: string; name: string } | null;
  }[];
}

const CURRENT_YEAR = new Date().getFullYear();
const SERIES_OPTIONS = [
  '1º Ano',
  '2º Ano',
  '3º Ano',
  '4º Ano',
  '5º Ano',
  '6º Ano',
  '7º Ano',
  '8º Ano',
  '9º Ano',
  '1ª Série EM',
  '2ª Série EM',
  '3ª Série EM',
];

export default function AlunoDetalhePage() {
  const params = useParams();
  const schoolId = params.id as string;
  const studentId = params.studentId as string;
  const queryClient = useQueryClient();

  const [newYear, setNewYear] = useState<number>(CURRENT_YEAR);
  const [newSeries, setNewSeries] = useState('');
  const [newSituation, setNewSituation] = useState<'CURSANDO' | 'CONCLUIDO' | 'TRANSFERIDO' | 'EVADIDO'>('CURSANDO');
  const [newTurmaId, setNewTurmaId] = useState<string>('');

  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null);
  const [editSituation, setEditSituation] = useState<
    'CURSANDO' | 'CONCLUIDO' | 'TRANSFERIDO' | 'EVADIDO'
  >('CURSANDO');
  const [editTurmaId, setEditTurmaId] = useState<string>('');
  const [editYearForTurmas, setEditYearForTurmas] = useState<number | null>(null);
  const novaMatriculaRef = useRef<HTMLElement | null>(null);
  const hasScrolledToHashRef = useRef(false);
  const [matriculaMsg, setMatriculaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: student, isLoading, error } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => fetchWithAuth<StudentDetail>(`/schools/${schoolId}/students/${studentId}`),
    enabled: !!studentId && !!schoolId,
  });

  const { data: turmas } = useQuery({
    queryKey: ['turmas', schoolId, newYear],
    queryFn: () => fetchTurmas(schoolId, newYear),
    enabled: !!schoolId,
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: () =>
      createEnrollment(schoolId, studentId, {
        year: newYear,
        series: newSeries.trim(),
        situation: newSituation,
        turmaId: newTurmaId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      setNewSeries('');
      setNewTurmaId('');
      setMatriculaMsg({ type: 'success', text: 'Matrícula criada com sucesso.' });
      setTimeout(() => setMatriculaMsg(null), 5000);
    },
    onError: (err: Error) => {
      const isJaMatriculado = /já matriculado|já existe.*matrícula/i.test(err.message);
      setMatriculaMsg({
        type: 'error',
        text: isJaMatriculado ? 'Aluno(a) já matriculado.' : err.message,
      });
    },
  });

  const { data: editTurmas } = useQuery({
    queryKey: ['turmas', schoolId, editYearForTurmas],
    queryFn: () => fetchTurmas(schoolId, editYearForTurmas ?? CURRENT_YEAR),
    enabled: !!schoolId && editYearForTurmas != null,
  });

  const updateEnrollmentMutation = useMutation({
    mutationFn: (payload: { enrollmentId: string; situation: string; turmaId?: string | null }) =>
      updateEnrollment(schoolId, studentId, payload.enrollmentId, {
        situation: payload.situation as
          | 'CURSANDO'
          | 'CONCLUIDO'
          | 'TRANSFERIDO'
          | 'EVADIDO',
        turmaId: payload.turmaId ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      setEditingEnrollmentId(null);
      setEditTurmaId('');
      setEditYearForTurmas(null);
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Carregando...</p>
      </AppLayout>
    );
  }

  if (error || !student) {
    return (
      <AppLayout>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">{error?.message ?? 'Aluno não encontrado'}</p>
          <p className="mt-2 text-sm">Verifique o endereço ou tente novamente mais tarde.</p>
        </div>
        <Link href={`/escolas/${schoolId}/alunos`} className="mt-4 inline-block text-primary hover:underline">
          ← Voltar aos alunos
        </Link>
      </AppLayout>
    );
  }

  const scrollToNovaMatricula = () => {
    novaMatriculaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <AppLayout>
      <p className="mb-4">
        <Link href={`/escolas/${schoolId}/alunos`} className="text-primary hover:underline">← Voltar aos alunos</Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-semibold">{student.name}</h2>
        <button
          type="button"
          onClick={scrollToNovaMatricula}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Criar matrícula
        </button>
      </div>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Data de nascimento</dt>
            <dd>{new Date(student.birthDate).toLocaleDateString('pt-BR')}</dd>
          </div>
          {student.cpf && (
            <div>
              <dt className="text-muted-foreground">CPF</dt>
              <dd>{student.cpf}</dd>
            </div>
          )}
          {student.rg && (
            <div>
              <dt className="text-muted-foreground">RG</dt>
              <dd>{student.rg}</dd>
            </div>
          )}
          {student.address && (
            <div>
              <dt className="text-muted-foreground">Endereço</dt>
              <dd>{student.address}</dd>
            </div>
          )}
        </dl>
        <div className="mt-6">
          <Link
            href={`/escolas/${schoolId}/alunos/${studentId}/documentos`}
            className="inline-block rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
          >
            Documentos do aluno (RG, certidão, etc.)
          </Link>
        </div>
        {student.contacts?.length > 0 && (
          <section className="mt-8">
            <h3 className="font-medium mb-2">Contatos</h3>
            <ul className="space-y-1 text-sm">
              {student.contacts.map((c, i) => (
                <li key={i}>
                  {c.name}
                  {c.phone && ` • ${c.phone}`}
                  {c.email && ` • ${c.email}`}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section
          className="mt-8 space-y-4"
          id="nova-matricula"
          ref={(el) => {
            novaMatriculaRef.current = el;
            if (el && typeof window !== 'undefined' && window.location.hash === '#nova-matricula' && !hasScrolledToHashRef.current) {
              hasScrolledToHashRef.current = true;
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        >
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium mb-3">Nova matrícula</h3>
            {matriculaMsg && (
              <div
                className={`mb-4 rounded-md px-3 py-2 text-sm ${
                  matriculaMsg.type === 'success'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                    : 'bg-destructive/10 text-destructive border border-destructive/30'
                }`}
              >
                {matriculaMsg.text}
              </div>
            )}
            <div className="flex flex-wrap gap-4 items-end text-sm">
              <div>
                <label className="block text-muted-foreground mb-1">Ano letivo</label>
                <select
                  value={newYear}
                  onChange={(e) => { setNewYear(Number(e.target.value)); setMatriculaMsg(null); }}
                  className="rounded border px-3 py-2"
                >
                  {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Série</label>
                <select
                  value={newSeries}
                  onChange={(e) => { setNewSeries(e.target.value); setMatriculaMsg(null); }}
                  className="rounded border px-3 py-2 min-w-[140px]"
                >
                  <option value="">Selecione...</option>
                  {SERIES_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Situação</label>
                <select
                  value={newSituation}
                  onChange={(e) =>
                    setNewSituation(e.target.value as 'CURSANDO' | 'CONCLUIDO' | 'TRANSFERIDO' | 'EVADIDO')
                  }
                  className="rounded border px-3 py-2"
                >
                  <option value="CURSANDO">Cursando</option>
                  <option value="CONCLUIDO">Concluído</option>
                  <option value="TRANSFERIDO">Transferido</option>
                  <option value="EVADIDO">Evadido</option>
                </select>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Turma (opcional)</label>
                <select
                  value={newTurmaId}
                  onChange={(e) => setNewTurmaId(e.target.value)}
                  className="rounded border px-3 py-2 min-w-[160px]"
                >
                  <option value="">— Sem turma —</option>
                  {turmas?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.year} • {t.name} ({t.series}) {t.turno ? `- ${t.turno}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground max-w-xs">
                  As turmas listadas são do ano selecionado. Se não aparecer nenhuma,
                  crie turmas em <strong>Escolas → Turmas</strong> para este ano.
                </p>
              </div>
              <button
                type="button"
                onClick={() => createEnrollmentMutation.mutate()}
                disabled={!newSeries.trim() || createEnrollmentMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {createEnrollmentMutation.isPending ? 'Criando matrícula...' : 'Criar matrícula'}
              </button>
            </div>
          </div>

          {student.enrollments?.length > 0 && (
            <section>
              <h3 className="font-medium mb-2">Matrículas</h3>
              <ul className="space-y-2">
                {student.enrollments.map((e) => {
                  const isEditing = editingEnrollmentId === e.id;
                  const turmaLabel = e.turma ? e.turma.name : '—';
                  return (
                    <li
                      key={e.id}
                      className="rounded border p-3 text-sm flex justify-between items-center flex-wrap gap-2"
                    >
                      <div className="flex flex-col gap-1">
                        <span>
                          {e.year} — {e.series}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Situação:{' '}
                          {isEditing ? (
                            <select
                              value={editSituation}
                              onChange={(ev) =>
                                setEditSituation(
                                  ev.target.value as
                                    | 'CURSANDO'
                                    | 'CONCLUIDO'
                                    | 'TRANSFERIDO'
                                    | 'EVADIDO',
                                )
                              }
                              className="rounded border px-2 py-1 text-xs"
                            >
                              <option value="CURSANDO">Cursando</option>
                              <option value="CONCLUIDO">Concluído</option>
                              <option value="TRANSFERIDO">Transferido</option>
                              <option value="EVADIDO">Evadido</option>
                            </select>
                          ) : (
                            e.situation
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Turma:{' '}
                          {isEditing ? (
                            <select
                              value={editTurmaId}
                              onChange={(ev) => setEditTurmaId(ev.target.value)}
                              className="rounded border px-2 py-1 text-xs min-w-[140px]"
                            >
                              <option value="">— Sem turma —</option>
                              {editTurmas?.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.year} • {t.name} ({t.series}) {t.turno ? `- ${t.turno}` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            turmaLabel
                          )}
                        </span>
                      </div>
                      <span className="flex gap-3 items-center">
                        <Link
                          href={`/escolas/${schoolId}/alunos/${studentId}/notas/${e.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Lançar notas
                        </Link>
                        <Link
                          href={`/boletim/${e.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Ver boletim
                        </Link>
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEnrollmentId(e.id);
                              setEditSituation(
                                e.situation as
                                  | 'CURSANDO'
                                  | 'CONCLUIDO'
                                  | 'TRANSFERIDO'
                                  | 'EVADIDO',
                              );
                              setEditTurmaId(e.turma?.id ?? '');
                              setEditYearForTurmas(e.year);
                            }}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Editar
                          </button>
                        )}
                        {isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                updateEnrollmentMutation.mutate({
                                  enrollmentId: e.id,
                                  situation: editSituation,
                                  turmaId: editTurmaId || null,
                                })
                              }
                              disabled={updateEnrollmentMutation.isPending}
                              className="text-xs text-primary hover:underline"
                            >
                              {updateEnrollmentMutation.isPending ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEnrollmentId(null);
                                setEditTurmaId('');
                                setEditYearForTurmas(null);
                              }}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </section>
    </AppLayout>
  );
}
