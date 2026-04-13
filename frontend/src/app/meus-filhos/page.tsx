'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { useAuthStore } from '@/store/auth';
import { getMyGuardianStudents } from '@/lib/api';

export default function MeusFilhosPage() {
  const user = useAuthStore((s) => s.user);

  const { data: students, isLoading } = useQuery({
    queryKey: ['me', 'guardian-students'],
    queryFn: getMyGuardianStudents,
    enabled: user?.role === 'PAIS_RESPONSAVEL',
  });

  if (user?.role !== 'PAIS_RESPONSAVEL') {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Acesso restrito a responsáveis.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h2 className="text-2xl font-semibold mb-6">Meus filhos</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Aqui você pode ver boletim e documentos dos alunos que estão sob sua responsabilidade.
      </p>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      {!isLoading && (!students || students.length === 0) && (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">
            Nenhum aluno vinculado ao seu usuário. Peça à secretaria da escola para vincular seu cadastro aos seus filhos.
          </p>
        </div>
      )}

      {!isLoading && students && students.length > 0 && (
        <div className="space-y-6">
          {students.map((s) => (
            <div key={s.id} className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold text-lg">{s.name}</h3>
              <p className="text-sm text-muted-foreground">
                Nasc.: {new Date(s.birthDate).toLocaleDateString('pt-BR')} — {s.school.name}
              </p>
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Matrículas</p>
                <ul className="space-y-2">
                  {s.enrollments.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-3">
                      <span className="text-sm">
                        {e.year} — {e.series} — {e.situation}
                      </span>
                      <Link
                        href={`/boletim/${e.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Ver boletim
                      </Link>
                      <Link
                        href={`/meus-filhos/documentos/${s.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Documentos
                      </Link>
                    </li>
                  ))}
                </ul>
                {s.enrollments.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma matrícula registrada.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
