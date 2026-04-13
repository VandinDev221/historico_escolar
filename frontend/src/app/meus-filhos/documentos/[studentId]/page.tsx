'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { fetchDocumentsByStudent } from '@/lib/api';

const TYPE_LABEL: Record<string, string> = {
  MATRICULA: 'Matrícula',
  TRANSFERENCIA: 'Transferência',
  CONCLUSAO: 'Conclusão',
  FREQUENCIA: 'Frequência',
  HISTORICO_ESCOLAR: 'Histórico Escolar',
};

export default function DocumentosAlunoPage() {
  const params = useParams();
  const studentId = params.studentId as string;

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['documents', 'student', studentId],
    queryFn: () => fetchDocumentsByStudent(studentId),
    enabled: !!studentId,
  });

  return (
    <AppLayout>
      <p className="mb-4">
        <Link href="/meus-filhos" className="text-primary hover:underline">
          ← Meus filhos
        </Link>
      </p>
      <h2 className="text-2xl font-semibold mb-6">Documentos do aluno</h2>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {error && <p className="text-destructive">{(error as Error).message}</p>}

      {!isLoading && documents && (
        <ul className="space-y-3">
          {documents.length === 0 ? (
            <li className="text-muted-foreground">Nenhum documento emitido.</li>
          ) : (
            documents.map((doc) => (
              <li key={doc.id} className="rounded border p-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{TYPE_LABEL[doc.type] ?? doc.type}</span>
                <span className="text-sm text-muted-foreground">{doc.school?.name}</span>
                <div className="flex gap-3">
                  <a
                    href={`/validar/${doc.validationCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Validar
                  </a>
                  <a
                    href={`/api/documents/pdf/${encodeURIComponent(doc.validationCode)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Baixar PDF
                  </a>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </AppLayout>
  );
}
