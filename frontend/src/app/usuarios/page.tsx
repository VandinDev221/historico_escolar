'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/AppLayout';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  fetchWithAuth,
  fetchGradeConfigsBySchool,
  type UserListItem,
  type UserRole,
  type CreateUserPayload,
  type UpdateUserPayload,
  type GradeConfig,
} from '@/lib/api';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN_ESCOLAR', label: 'Admin Escolar' },
  { value: 'PROFESSOR', label: 'Professor' },
  { value: 'PAIS_RESPONSAVEL', label: 'Pais/Responsável' },
];

interface School {
  id: string;
  name: string;
}

export default function UsuariosPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<UserListItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace('/');
    }
  }, [user, router]);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: schools } = useQuery({
    queryKey: ['schools'],
    queryFn: () => fetchWithAuth<School[]>('/schools'),
    enabled: user?.role === 'SUPER_ADMIN' && (modal === 'create' || modal === 'edit'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModal(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModal(null);
      setSelected(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModal(null);
      setSelected(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (user && user.role !== 'SUPER_ADMIN') {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Redirecionando...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-2xl font-semibold">Usuários</h2>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setModal('create');
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Novo usuário
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando usuários...</p>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">E-mail</th>
                <th className="text-left p-3 font-medium">Perfil</th>
                <th className="text-left p-3 font-medium">Escola</th>
                <th className="text-left p-3 font-medium">Disciplinas</th>
                <th className="text-left p-3 font-medium">Ativo</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.role.replace('_', ' ')}</td>
                  <td className="p-3">{u.school?.name ?? '—'}</td>
                  <td className="p-3">
                    {u.role === 'PROFESSOR' && u.teacherDisciplines?.length
                      ? u.teacherDisciplines.map((t) => t.gradeConfig.subject).join(', ')
                      : '—'}
                  </td>
                  <td className="p-3">{u.active ? 'Sim' : 'Não'}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(u);
                        setError(null);
                        setModal('edit');
                      }}
                      className="text-primary hover:underline mr-3"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(u);
                        setError(null);
                        setModal('delete');
                      }}
                      className="text-destructive hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users?.length === 0 && (
            <p className="p-6 text-center text-muted-foreground">Nenhum usuário cadastrado.</p>
          )}
        </div>
      )}

      {modal === 'create' && (
        <UserForm
          mode="create"
          schools={schools ?? []}
          onClose={() => setModal(null)}
          onSubmit={(payload) => createMutation.mutate(payload)}
          isSubmitting={createMutation.isPending}
          error={error}
        />
      )}
      {modal === 'edit' && selected && (
        <UserForm
          mode="edit"
          schools={schools ?? []}
          initial={selected}
          onClose={() => {
            setModal(null);
            setSelected(null);
          }}
          onSubmit={(payload) => updateMutation.mutate({ id: selected.id, payload })}
          isSubmitting={updateMutation.isPending}
          error={error}
        />
      )}
      {modal === 'delete' && selected && (
        <DeleteConfirm
          name={selected.name}
          onClose={() => {
            setModal(null);
            setSelected(null);
          }}
          onConfirm={() => deleteMutation.mutate(selected.id)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </AppLayout>
  );
}

type UserFormProps =
  | {
      mode: 'create';
      schools: School[];
      onClose: () => void;
      onSubmit: (payload: CreateUserPayload) => void;
      isSubmitting: boolean;
      error: string | null;
    }
  | {
      mode: 'edit';
      schools: School[];
      initial: UserListItem;
      onClose: () => void;
      onSubmit: (payload: UpdateUserPayload) => void;
      isSubmitting: boolean;
      error: string | null;
    };

function UserForm(props: UserFormProps) {
  const { schools, onClose, isSubmitting, error } = props;
  const isEdit = props.mode === 'edit';
  const initial = isEdit ? props.initial : undefined;

  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(initial?.role ?? 'ADMIN_ESCOLAR');
  const [schoolId, setSchoolId] = useState<string>(initial?.schoolId ?? '');
  const [gradeConfigIds, setGradeConfigIds] = useState<string[]>(
    initial?.teacherDisciplines?.map((t) => t.gradeConfigId) ?? []
  );
  const [active, setActive] = useState(initial?.active ?? true);

  const { data: schoolDisciplines } = useQuery({
    queryKey: ['grade-configs-school', schoolId],
    queryFn: () => fetchGradeConfigsBySchool(schoolId),
    enabled: role === 'PROFESSOR' && !!schoolId,
  });

  const toggleDiscipline = (id: string) => {
    setGradeConfigIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (props.mode === 'edit') {
      const payload: UpdateUserPayload = { name, email, role, schoolId: schoolId || null, active };
      if (password.trim()) payload.password = password;
      if (role === 'PROFESSOR') payload.gradeConfigIds = gradeConfigIds;
      props.onSubmit(payload);
    } else {
      if (!password.trim()) return;
      const payload: CreateUserPayload = {
        name,
        email,
        password: password.trim(),
        role,
        schoolId: role === 'SUPER_ADMIN' ? null : schoolId || null,
      };
      if (role === 'PROFESSOR') payload.gradeConfigIds = gradeConfigIds;
      props.onSubmit(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-lg shadow-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">{isEdit ? 'Editar usuário' : 'Novo usuário'}</h3>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 text-destructive text-sm p-2">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-mail *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Senha {isEdit ? '(deixe em branco para não alterar)' : '*'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2"
              minLength={isEdit ? 0 : 6}
              placeholder={isEdit ? '••••••••' : ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Perfil *</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as UserRole);
                if (e.target.value === 'SUPER_ADMIN') setSchoolId('');
                if (e.target.value !== 'PROFESSOR') setGradeConfigIds([]);
              }}
              className="w-full rounded-md border border-border px-3 py-2"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {role !== 'SUPER_ADMIN' && (
            <div>
              <label className="block text-sm font-medium mb-1">Escola *</label>
              <select
                value={schoolId}
                onChange={(e) => {
                  setSchoolId(e.target.value);
                  setGradeConfigIds([]);
                }}
                className="w-full rounded-md border border-border px-3 py-2"
                required
              >
                <option value="">Selecione...</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {role === 'PROFESSOR' && schoolId && (
            <div>
              <label className="block text-sm font-medium mb-1">Disciplinas que leciona</label>
              <p className="text-xs text-muted-foreground mb-2">
                Selecione uma ou mais disciplinas. O professor só poderá lançar notas nelas.
              </p>
              {!schoolDisciplines ? (
                <p className="text-sm text-muted-foreground">Carregando disciplinas...</p>
              ) : schoolDisciplines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma disciplina configurada nesta escola. Configure as disciplinas por série primeiro.
                </p>
              ) : (
                <div className="max-h-40 overflow-auto rounded border border-border p-2 space-y-1">
                  {schoolDisciplines.map((c: GradeConfig) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gradeConfigIds.includes(c.id)}
                        onChange={() => toggleDiscipline(c.id)}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {c.subject} — {c.series}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="active" className="text-sm">
                Usuário ativo
              </label>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!isEdit && !password.trim())}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({
  name,
  onClose,
  onConfirm,
  isDeleting,
}: {
  name: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-lg shadow-lg max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold mb-2">Excluir usuário</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Tem certeza que deseja excluir o usuário <strong>{name}</strong>? Esta ação não pode ser
          desfeita.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
