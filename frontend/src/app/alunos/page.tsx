'use client';

import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';

export default function AlunosPage() {
  return (
    <AppLayout>
      <h2 className="text-2xl font-semibold mb-6">Alunos</h2>
      <p className="text-muted-foreground">
        Selecione uma escola para ver e gerenciar os alunos.
      </p>
      <Link
        href="/escolas"
        className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Ver escolas
      </Link>
    </AppLayout>
  );
}
