'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { fetchWithAuth, generateHistoricoEscolar } from '@/lib/api';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';

interface Student {
  id: string;
  name: string;
}

interface StudentsResponse {
  items: Student[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Enrollment {
  id: string;
  year: number;
  series: string;
  situation: string;
  schoolId?: string;
  school?: { id: string };
}

const TIPOS = [
  { value: 'MATRICULA', label: 'Matrícula' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'CONCLUSAO', label: 'Conclusão' },
  { value: 'FREQUENCIA', label: 'Frequência' },
] as const;

export default function GerarDeclaracaoPage() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const schoolId = params.schoolId as string;

  useEffect(() => {
    if (user?.role === 'PROFESSOR') router.replace('/documentos');
  }, [user?.role, router]);

  const [type, setType] = useState<string>('MATRICULA');
  const [studentId, setStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOpen, setStudentOpen] = useState(false);
  const studentComboboxRef = useRef<HTMLDivElement>(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ content: string; validationCode: string; validateUrl: string } | null>(null);
  const [historicoResult, setHistoricoResult] = useState<{ validationCode: string; validateUrl: string } | null>(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);

  const { data: studentsData } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () =>
      fetchWithAuth<StudentsResponse>(`/schools/${schoolId}/students?page=1&limit=500`),
    enabled: !!schoolId,
  });
  const students = studentsData?.items ?? [];

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    const filtered = students.filter((s) => s.name.toLowerCase().includes(q));
    const selected = students.find((s) => s.id === studentId);
    if (selected && !filtered.some((s) => s.id === studentId)) {
      return [selected, ...filtered];
    }
    return filtered;
  }, [students, studentSearch, studentId]);

  const { data: enrollmentsRaw } = useQuery({
    queryKey: ['enrollments', studentId],
    queryFn: () => fetchWithAuth<Enrollment[]>(`/schools/${schoolId}/students/${studentId}/enrollments`),
    enabled: !!studentId,
  });
  const enrollments = (enrollmentsRaw ?? []).filter((e) => !e.school?.id || e.school.id === schoolId);

  const selectedStudent = students.find((s) => s.id === studentId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (studentComboboxRef.current && !studentComboboxRef.current.contains(e.target as Node)) {
        setStudentOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!studentId) {
      setError('Selecione um aluno.');
      return;
    }
    const body: { type: string; studentId: string; enrollmentId?: string } = {
      type,
      studentId,
    };
    if (['TRANSFERENCIA', 'CONCLUSAO', 'FREQUENCIA'].includes(type) && enrollmentId) {
      body.enrollmentId = enrollmentId;
    }
    try {
      const res = await fetchWithAuth<{ content: string; validationCode: string; validateUrl: string }>(
        `/documents/schools/${schoolId}/generate`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['documents', schoolId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar declaração');
    }
  };

  const handleGerarHistorico = async () => {
    if (!studentId) return;
    setHistoricoError(null);
    setHistoricoResult(null);
    setHistoricoLoading(true);
    try {
      const res = await generateHistoricoEscolar(schoolId, studentId);
      setHistoricoResult({ validationCode: res.validationCode, validateUrl: res.validateUrl });
      queryClient.invalidateQueries({ queryKey: ['documents', schoolId] });
    } catch (err) {
      setHistoricoError(err instanceof Error ? err.message : 'Erro ao gerar histórico.');
    } finally {
      setHistoricoLoading(false);
    }
  };

  return (
    <AppLayout>
      <p className="mb-4">
        <Link href="/documentos" className="text-primary hover:underline">← Documentos</Link>
      </p>
      <h2 className="text-2xl font-semibold mb-6">Gerar declaração</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Tipo *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div ref={studentComboboxRef} className="relative">
            <label className="block text-sm font-medium mb-1">Aluno *</label>
            <div
              role="combobox"
              aria-expanded={studentOpen}
              aria-haspopup="listbox"
              className="w-full rounded-md border border-border bg-background min-h-[42px] flex items-center"
            >
              {studentOpen ? (
                <input
                  type="search"
                  placeholder="Buscar aluno por nome..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  onBlur={() => {}}
                  autoFocus
                  className="flex-1 min-w-0 rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none border-0 bg-transparent"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setStudentOpen(true)}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent/50 rounded-md flex items-center justify-between"
                >
                  <span className={selectedStudent ? '' : 'text-muted-foreground'}>
                    {selectedStudent ? selectedStudent.name : 'Buscar aluno por nome...'}
                  </span>
                  <span className="text-muted-foreground">▼</span>
                </button>
              )}
            </div>
            {studentOpen && (
              <ul
                role="listbox"
                className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border border-border bg-card shadow-lg py-1"
              >
                {filteredStudents.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum aluno encontrado</li>
                ) : (
                  filteredStudents.map((s) => (
                    <li
                      key={s.id}
                      role="option"
                      aria-selected={s.id === studentId}
                      onClick={() => {
                        setStudentId(s.id);
                        setEnrollmentId('');
                        setStudentSearch('');
                        setStudentOpen(false);
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent ${s.id === studentId ? 'bg-primary/10 text-primary font-medium' : ''}`}
                    >
                      {s.name}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {['TRANSFERENCIA', 'CONCLUSAO', 'FREQUENCIA'].includes(type) && (
            <div>
              <label className="block text-sm font-medium mb-1">Matrícula (ano/série) *</label>
              <select
                value={enrollmentId}
                onChange={(e) => setEnrollmentId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                required={['TRANSFERENCIA', 'CONCLUSAO', 'FREQUENCIA'].includes(type)}
              >
                <option value="">Selecione...</option>
                {enrollments?.map((e) => (
                  <option key={e.id} value={e.id}>{e.year} — {e.series}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Gerar declaração
          </button>
        </form>

        {studentId && (
          <div className="mt-8 rounded-lg border bg-card p-4">
            <h3 className="font-medium mb-2">Histórico Escolar</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Gera documento único com todas as matrículas do aluno nesta escola (notas, frequência, carga horária).
            </p>
            {historicoError && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3 mb-3">{historicoError}</div>
            )}
            <button
              type="button"
              onClick={handleGerarHistorico}
              disabled={historicoLoading}
              className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {historicoLoading ? 'Gerando...' : 'Gerar Histórico Escolar'}
            </button>
            {historicoResult && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-sm">Código de validação: <strong>{historicoResult.validationCode}</strong></p>
                <div className="flex flex-wrap gap-4">
                  <a href={historicoResult.validateUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    Abrir validação (QR Code)
                  </a>
                  <a href={`/api/documents/pdf/${encodeURIComponent(historicoResult.validationCode)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    Baixar PDF
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="mt-8 rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-medium">Declaração gerada</h3>
            <pre className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">{result.content}</pre>
            <p className="text-sm text-muted-foreground">
              Código de validação: <strong>{result.validationCode}</strong>
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href={result.validateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Abrir link de validação (QR Code)
              </a>
              <a
                href={`/api/documents/pdf/${result.validationCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Baixar PDF
              </a>
            </div>
          </div>
        )}
    </AppLayout>
  );
}
