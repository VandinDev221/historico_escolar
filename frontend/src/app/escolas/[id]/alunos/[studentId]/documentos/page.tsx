'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';

const DOC_TYPES = [
  { value: 'RG', label: 'RG' },
  { value: 'CPF', label: 'CPF' },
  { value: 'CERTIDAO_NASCIMENTO', label: 'Certidão de Nascimento' },
  { value: 'FOTO_3X4', label: 'Foto 3x4' },
  { value: 'COMPROVANTE_RESIDENCIA', label: 'Comprovante de Residência' },
  { value: 'OUTRO', label: 'Outro' },
];

interface StudentDoc {
  id: string;
  type: string;
  name: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export default function StudentDocumentsPage() {
  const params = useParams();
  const schoolId = params.id as string;
  const studentId = params.studentId as string;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('RG');
  const [filePath, setFilePath] = useState('');

  const { data: docs, isLoading } = useQuery({
    queryKey: ['student-documents', studentId],
    queryFn: () =>
      fetchWithAuth<StudentDoc[]>(`/schools/${schoolId}/students/${studentId}/documents`),
    enabled: !!studentId && !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (body: { type: string; name: string; filePath: string }) =>
      fetchWithAuth<StudentDoc>(`/schools/${schoolId}/students/${studentId}/documents`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] });
      setShowForm(false);
      setName('');
      setFilePath('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      fetchWithAuth(`/schools/${schoolId}/students/${studentId}/documents/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !filePath.trim()) return;
    createMutation.mutate({ type, name: name.trim(), filePath: filePath.trim() });
  };

  return (
    <AppLayout>
      <p className="mb-4">
        <Link
          href={`/escolas/${schoolId}/alunos/${studentId}`}
          className="text-primary hover:underline"
        >
          ← Aluno
        </Link>
      </p>
      <h2 className="text-2xl font-semibold mb-2">Documentos do aluno</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Anexe RG, CPF, certidão, foto, comprovante de residência etc. para ambiente de produção.
        </p>

        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 mb-6"
        >
          {showForm ? 'Cancelar' : '+ Adicionar documento'}
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 mb-6 max-w-md">
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded border px-3 py-2 mb-3"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className="block text-sm font-medium mb-1">Nome (ex.: RG - frente)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border px-3 py-2 mb-3"
              required
            />
            <label className="block text-sm font-medium mb-1">Caminho do arquivo ou URL</label>
            <input
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/uploads/alunos/xyz/rg.pdf ou https://..."
              className="w-full rounded border px-3 py-2 mb-3"
              required
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {createMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !docs?.length ? (
          <p className="text-muted-foreground">Nenhum documento anexado. Adicione os documentos do aluno para produção.</p>
        ) : (
          <ul className="space-y-3">
            {docs.map((d) => (
              <li key={d.id} className="rounded-lg border bg-card p-4 flex justify-between items-center flex-wrap gap-2">
                <div>
                  <span className="font-medium">{DOC_TYPES.find((t) => t.value === d.type)?.label ?? d.type}</span>
                  <span className="ml-2 text-sm text-muted-foreground">— {d.name}</span>
                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">{d.filePath}</p>
                  <p className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(d.id)}
                  disabled={removeMutation.isPending}
                  className="text-sm text-destructive hover:underline"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
    </AppLayout>
  );
}
