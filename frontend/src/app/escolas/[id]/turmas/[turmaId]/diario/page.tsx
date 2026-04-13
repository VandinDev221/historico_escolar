'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { useAuthStore } from '@/store/auth';
import { getDiary, upsertDiary, justifyAbsence, getAtestadoImageBlobUrl } from '@/lib/api';
import type { DiaryItem } from '@/lib/api';

function AtestadoImageLink({
  schoolId,
  turmaId,
  recordId,
}: {
  schoolId: string;
  turmaId: string;
  recordId: string;
}) {
  const [loading, setLoading] = useState(false);
  const handleVerImagem = useCallback(async () => {
    setLoading(true);
    try {
      const url = await getAtestadoImageBlobUrl(schoolId, turmaId, recordId);
      const w = window.open(url, '_blank', 'noopener');
      if (w) w.onbeforeunload = () => URL.revokeObjectURL(url);
      else URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [schoolId, turmaId, recordId]);
  return (
    <button
      type="button"
      onClick={handleVerImagem}
      disabled={loading}
      className="text-left underline hover:no-underline font-medium"
    >
      {loading ? 'Carregando…' : 'Ver imagem do atestado'}
    </button>
  );
}

export default function DiarioPage() {
  const params = useParams();
  const schoolId = params.id as string;
  const turmaId = params.turmaId as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isGestor = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_ESCOLAR';
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [justifyModal, setJustifyModal] = useState<{ recordId: string; studentName: string } | null>(null);
  const [justifyNote, setJustifyNote] = useState('');
  const [justifyAtestadoDoc, setJustifyAtestadoDoc] = useState('');
  const [justifyAtestadoFile, setJustifyAtestadoFile] = useState<File | null>(null);
  const [justifyOpening, setJustifyOpening] = useState(false);
  const [justifyError, setJustifyError] = useState<string | null>(null);

  const { data: diary, isLoading } = useQuery({
    queryKey: ['diary', schoolId, turmaId, date],
    queryFn: () => getDiary(schoolId, turmaId, date),
    enabled: !!schoolId && !!turmaId && !!date,
  });

  const turma = diary?.turma;
  const baseItems = diary?.items ?? [];
  const hasChamadaSalva = baseItems.some((i) => i.attendanceRecordId);
  const canEditDiary = isGestor || !hasChamadaSalva;
  const displayList = baseItems.map((i) => ({
    ...i,
    present: overrides[i.enrollmentId] !== undefined ? overrides[i.enrollmentId] : i.present,
  }));

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertDiary(schoolId, turmaId, {
        date,
        records: displayList.map((i) => ({ enrollmentId: i.enrollmentId, present: i.present })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary', schoolId, turmaId, date] });
      setOverrides({});
    },
  });

  const justifyMutation = useMutation({
    mutationFn: ({
      recordId,
      note,
      atestadoDocRef,
      atestadoImage,
    }: {
      recordId: string;
      note?: string;
      atestadoDocRef?: string;
      atestadoImage?: File;
    }) =>
      justifyAbsence(schoolId, turmaId, recordId, {
        note: note || undefined,
        atestadoDocRef: atestadoDocRef || undefined,
        atestadoImage: atestadoImage || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary', schoolId, turmaId, date] });
      setJustifyModal(null);
      setJustifyNote('');
      setJustifyAtestadoDoc('');
      setJustifyAtestadoFile(null);
      setJustifyError(null);
    },
    onError: (err: Error) => {
      setJustifyError(err.message || 'Erro ao justificar falta.');
    },
  });

  const togglePresent = (enrollmentId: string) => {
    const current = overrides[enrollmentId] !== undefined
      ? overrides[enrollmentId]
      : baseItems.find((b) => b.enrollmentId === enrollmentId)?.present ?? true;
    setOverrides((prev) => ({ ...prev, [enrollmentId]: !current }));
  };

  const openJustify = async (item: DiaryItem) => {
    let recordId = item.attendanceRecordId;
    if (!recordId) {
      setJustifyOpening(true);
      try {
        const saved = await upsertDiary(schoolId, turmaId, {
          date,
          records: displayList.map((i) => ({ enrollmentId: i.enrollmentId, present: i.present })),
        });
        recordId = saved.items.find((i) => i.enrollmentId === item.enrollmentId)?.attendanceRecordId ?? null;
        if (recordId) {
          queryClient.invalidateQueries({ queryKey: ['diary', schoolId, turmaId, date] });
          setOverrides({});
        }
      } catch {
        setJustifyOpening(false);
        return;
      }
      setJustifyOpening(false);
      if (!recordId) return;
    }
    setJustifyError(null);
    setJustifyModal({ recordId, studentName: item.studentName });
    setJustifyNote(item.justifiedNote ?? '');
    setJustifyAtestadoDoc(item.atestadoDocRef ?? '');
    setJustifyAtestadoFile(null);
  };

  return (
    <AppLayout>
      <p className="mb-4">
        <Link href={`/escolas/${schoolId}/turmas`} className="text-primary hover:underline">
          ← Voltar às turmas
        </Link>
      </p>
      <h2 className="text-2xl font-semibold mb-2">Diário de classe</h2>
      {turma && (
        <p className="text-muted-foreground text-sm mb-4">
          {turma.name} — {turma.series} — {turma.year}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">Data:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
        {canEditDiary && (
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={displayList.length === 0 || saveMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Salvando...' : 'Salvar chamada'}
          </button>
        )}
      </div>

      {!canEditDiary && hasChamadaSalva && (
        <p className="mb-4 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Chamada já registrada para esta data. Apenas o admin da escola pode alterar.
        </p>
      )}

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      {!isLoading && displayList.length === 0 && (
        <p className="text-muted-foreground">Nenhum aluno vinculado a esta turma. Vincule matrículas à turma para registrar frequência.</p>
      )}

      {!isLoading && displayList.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Aluno</th>
                <th className="text-left p-3 font-medium w-28">Presença</th>
                {isGestor && <th className="text-left p-3 font-medium">Justificativa</th>}
              </tr>
            </thead>
            <tbody>
              {displayList.map((item) => (
                <tr key={item.enrollmentId} className="border-b last:border-0">
                  <td className="p-3">{item.studentName}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => canEditDiary && togglePresent(item.enrollmentId)}
                      disabled={!canEditDiary}
                      className={`rounded px-3 py-1 text-sm ${
                        item.present
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                      } ${!canEditDiary ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                      {item.present ? 'Presente' : 'Falta'}
                    </button>
                  </td>
                  {isGestor && (
                    <td className="p-3">
                      {!item.present && item.justified && (
                        <span className="inline-flex flex-col gap-0.5 rounded-md bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                          <span>Justificada{item.justifiedByName && ` (${item.justifiedByName})`}</span>
                          {item.atestadoDocRef && <span className="font-medium">Doc. do atestado (armazenado): {item.atestadoDocRef}</span>}
                          {item.justifiedNote && <span>{item.justifiedNote}</span>}
                          {item.atestadoImageUrl && item.attendanceRecordId && (
                            <AtestadoImageLink
                              schoolId={schoolId}
                              turmaId={turmaId}
                              recordId={item.attendanceRecordId}
                            />
                          )}
                        </span>
                      )}
                      {!item.present && !item.justified && (
                        <button
                          type="button"
                          onClick={() => openJustify(item)}
                          disabled={justifyOpening}
                          className="rounded border border-amber-600 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/30"
                        >
                          {justifyOpening ? '...' : 'Justificar falta'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {justifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setJustifyModal(null); setJustifyNote(''); setJustifyAtestadoDoc(''); setJustifyAtestadoFile(null); setJustifyError(null); }}>
          <div className="rounded-lg border bg-card p-4 shadow-lg max-w-sm w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium mb-2">Justificar falta — {justifyModal.studentName}</h3>
            <p className="text-sm text-muted-foreground mb-3">Informe o doc. do atestado e opcionalmente anexe a imagem escaneada.</p>
            {justifyError && (
              <p className="text-sm text-destructive mb-2 bg-destructive/10 rounded px-2 py-1">{justifyError}</p>
            )}
            <label className="block mb-1 text-sm font-medium">
              Imagem do atestado escaneado <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setJustifyAtestadoFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm mb-2"
            />
            {justifyAtestadoFile && (
              <p className="text-xs text-muted-foreground mb-2">
                Arquivo: {justifyAtestadoFile.name}
                {justifyAtestadoFile.type.startsWith('image/') && (
                  <span className="block mt-1">
                    <img
                      src={URL.createObjectURL(justifyAtestadoFile)}
                      alt="Preview atestado"
                      className="max-h-24 rounded border object-contain"
                    />
                  </span>
                )}
              </p>
            )}
            <label className="block mb-1 text-sm font-medium">
              Doc. do documento do atestado <span className="text-muted-foreground font-normal">(armazenado na justificativa)</span>
            </label>
            <input
              type="text"
              placeholder="Ex.: nº do atestado, protocolo, referência do documento"
              value={justifyAtestadoDoc}
              onChange={(e) => setJustifyAtestadoDoc(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm mb-3"
              maxLength={200}
              aria-describedby="atestado-doc-hint"
            />
            <p id="atestado-doc-hint" className="text-xs text-muted-foreground mb-3">O número ou referência do documento do atestado fica gravado na justificativa para consulta posterior.</p>
            <label className="block mb-1 text-sm font-medium text-muted-foreground">Motivo / observação (opcional)</label>
            <textarea
              placeholder="Ex.: Atestado médico"
              value={justifyNote}
              onChange={(e) => setJustifyNote(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm mb-3 min-h-[60px]"
              maxLength={500}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setJustifyModal(null); setJustifyNote(''); setJustifyAtestadoDoc(''); setJustifyAtestadoFile(null); setJustifyError(null); }}
                className="rounded border px-3 py-1.5 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => justifyMutation.mutate({
                  recordId: justifyModal.recordId,
                  note: justifyNote.trim() || undefined,
                  atestadoDocRef: justifyAtestadoDoc.trim() || undefined,
                  atestadoImage: justifyAtestadoFile || undefined,
                })}
                disabled={justifyMutation.isPending}
                className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {justifyMutation.isPending ? 'Salvando...' : 'Justificar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
