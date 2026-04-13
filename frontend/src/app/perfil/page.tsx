'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/AppLayout';
import {
  fetchMe,
  updateProfile,
  addMyDiscipline,
  removeMyDiscipline,
  fetchGradeConfigsBySchool,
  type MeProfile,
  type UpdateProfilePayload,
} from '@/lib/api';

export default function PerfilPage() {
  const queryClient = useQueryClient();
  const { user, setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [addDisciplineId, setAddDisciplineId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialNameSynced = useRef(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: !!user,
  });

  const isProfessor = profile?.role === 'PROFESSOR';
  const schoolId = profile?.schoolId ?? null;

  const { data: gradeConfigs = [] } = useQuery({
    queryKey: ['gradeConfigsBySchool', schoolId],
    queryFn: () => fetchGradeConfigsBySchool(schoolId!),
    enabled: isProfessor && !!schoolId,
  });

  useEffect(() => {
    if (profile?.name && !initialNameSynced.current) {
      setName(profile.name);
      initialNameSynced.current = true;
    }
  }, [profile?.name]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: (data: MeProfile) => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token && user) setAuth(token, { ...user, name: data.name });
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      setMessage('Dados atualizados com sucesso.');
      setError(null);
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  const addDisciplineMutation = useMutation({
    mutationFn: (gradeConfigId: string) => addMyDiscipline(gradeConfigId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setAddDisciplineId('');
      setMessage('Disciplina vinculada. O código foi gerado.');
      setError(null);
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  const removeDisciplineMutation = useMutation({
    mutationFn: (gradeConfigId: string) => removeMyDiscipline(gradeConfigId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setMessage('Disciplina removida do seu perfil.');
      setError(null);
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  const handleSubmitDados = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const payload: UpdateProfilePayload = {};
    if (name.trim() !== profile?.name) payload.name = name.trim();
    if (password) {
      if (password.length < 6) {
        setError('Nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Nova senha e confirmação não conferem.');
        return;
      }
      payload.password = password;
      payload.currentPassword = currentPassword;
    }
    if (Object.keys(payload).length === 0) {
      setMessage('Nenhuma alteração feita.');
      return;
    }
    updateMutation.mutate(payload);
  };

  const handleAddDiscipline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDisciplineId) return;
    setError(null);
    addDisciplineMutation.mutate(addDisciplineId);
  };

  if (isLoading || !profile) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Carregando perfil...</p>
      </AppLayout>
    );
  }

  const teacherDisciplines = profile.teacherDisciplines ?? [];
  const alreadyLinkedIds = new Set(teacherDisciplines.map((td) => td.gradeConfigId));
  const availableConfigs = gradeConfigs.filter((gc) => !alreadyLinkedIds.has(gc.id));

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-8">
        <h2 className="text-2xl font-semibold">Meu perfil</h2>

        {message && (
          <div className="rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm p-3">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
            {error}
          </div>
        )}

        {/* Dados e senha */}
        <section className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-medium mb-4">Dados pessoais</h3>
          <form onSubmit={handleSubmitDados} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="w-full rounded-md border bg-muted/50 px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">O e-mail não pode ser alterado aqui.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input
                type="text"
                value={name || profile.name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                minLength={2}
              />
            </div>
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Alterar senha</h4>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  placeholder="Nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Salvando...' : 'Salvar dados e/ou senha'}
            </button>
          </form>
        </section>

        {/* Disciplinas do professor */}
        {isProfessor && (
          <section className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-medium mb-2">Minhas disciplinas</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Cada disciplina vinculada gera um <strong>código</strong> que identifica você naquela matéria. Use esse código quando necessário (ex.: vínculo em outros sistemas).
            </p>

            {teacherDisciplines.length > 0 && (
              <ul className="space-y-2 mb-6">
                {teacherDisciplines.map((td) => (
                  <li
                    key={td.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span>
                      {td.gradeConfig.subject} — {td.gradeConfig.series}ª série
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-sm font-mono">{td.code}</code>
                      <button
                        type="button"
                        onClick={() => removeDisciplineMutation.mutate(td.gradeConfigId)}
                        disabled={removeDisciplineMutation.isPending}
                        className="text-sm text-destructive hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {availableConfigs.length > 0 && (
              <form onSubmit={handleAddDiscipline} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <label className="block text-sm font-medium mb-1">Cadastrar nova disciplina</label>
                  <select
                    value={addDisciplineId}
                    onChange={(e) => setAddDisciplineId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Selecione a disciplina</option>
                    {availableConfigs.map((gc) => (
                      <option key={gc.id} value={gc.id}>
                        {gc.subject} — {gc.series}ª série
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!addDisciplineId || addDisciplineMutation.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {addDisciplineMutation.isPending ? 'Vinculando...' : 'Vincular'}
                </button>
              </form>
            )}
            {isProfessor && schoolId && availableConfigs.length === 0 && teacherDisciplines.length > 0 && (
              <p className="text-sm text-muted-foreground">Você já está vinculado a todas as disciplinas da sua escola.</p>
            )}
          </section>
        )}
      </div>
    </AppLayout>
  );
}
