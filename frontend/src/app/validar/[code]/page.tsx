'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface ValidateResult {
  type: string;
  studentName: string;
  schoolName: string;
  municipalityName: string;
  state: string;
  generatedAt: string;
  enrollment: { year: number; series: string; situation: string } | null;
  gradesSummary?: string | null;
  valid: boolean;
}

export default function ValidarPage() {
  const params = useParams();
  const code = params.code as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['validate', code],
    queryFn: async (): Promise<ValidateResult> => {
      const res = await fetch(`/api/documents/validate/${encodeURIComponent(code)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Documento não encontrado');
      }
      return res.json();
    },
    enabled: !!code,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Verificando...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
        <p className="text-destructive font-medium text-center">
          {error?.message ?? 'Documento não encontrado ou código inválido.'}
        </p>
        <p className="text-sm text-muted-foreground mt-2 text-center">Verifique o código e tente novamente.</p>
        <a href="/" className="mt-6 text-sm text-primary hover:underline">Ir para o site</a>
      </div>
    );
  }

  const typeLabel: Record<string, string> = {
    MATRICULA: 'Declaração de Matrícula',
    TRANSFERENCIA: 'Declaração de Transferência',
    CONCLUSAO: 'Declaração de Conclusão',
    FREQUENCIA: 'Declaração de Frequência',
    HISTORICO_ESCOLAR: 'Histórico Escolar',
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-lg mx-auto rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-green-600 font-medium mb-4">
          <span className="text-2xl">✓</span> Documento válido
        </div>
        <h1 className="text-xl font-semibold text-card-foreground mb-4">
          {typeLabel[data.type] ?? data.type}
        </h1>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Aluno</dt>
            <dd className="font-medium">{data.studentName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Escola</dt>
            <dd>{data.schoolName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Município</dt>
            <dd>{data.municipalityName} / {data.state}</dd>
          </div>
          {data.enrollment && (
            <div>
              <dt className="text-muted-foreground">Ano / Série</dt>
              <dd>{data.enrollment.year} — {data.enrollment.series}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Data da declaração</dt>
            <dd>{new Date(data.generatedAt).toLocaleDateString('pt-BR')}</dd>
          </div>
        </dl>
        {data.gradesSummary && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Resumo de avaliação e frequência (LDB)</p>
            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto whitespace-pre-wrap font-sans">
              {data.gradesSummary}
            </pre>
          </div>
        )}
        <a
          href={`/api/documents/pdf/${encodeURIComponent(code)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Baixar PDF
        </a>
        <p className="mt-4 text-xs text-muted-foreground">
          Este documento foi validado pelo sistema de histórico escolar municipal.
        </p>
        <a href="/" className="mt-4 block text-sm text-primary hover:underline">Ir para o site</a>
      </div>
    </div>
  );
}
