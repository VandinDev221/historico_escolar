'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { getBoletim } from '@/lib/api';

export default function BoletimPage() {
  const params = useParams();
  const enrollmentId = params.enrollmentId as string;
  const printRef = useRef<HTMLDivElement>(null);

  const { data: boletim, isLoading, error } = useQuery({
    queryKey: ['boletim', enrollmentId],
    queryFn: () => getBoletim(enrollmentId),
    enabled: !!enrollmentId,
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Boletim - ${boletim?.student.name ?? 'Aluno'}</title>
        <style>
          body { font-family: sans-serif; padding: 16px; }
          table { border-collapse: collapse; width: 100%; margin-top: 12px; }
          th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
          th { background: #f0f0f0; }
        </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.print();
    win.close();
  };

  if (isLoading) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Carregando boletim...</p>
      </AppLayout>
    );
  }

  if (error || !boletim) {
    return (
      <AppLayout>
        <p className="text-destructive">{error?.message ?? 'Boletim não encontrado.'}</p>
        <Link href="/" className="mt-4 inline-block text-primary hover:underline">Voltar ao início</Link>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <Link href="/" className="text-primary hover:underline">← Voltar</Link>
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Imprimir boletim
        </button>
      </div>

      <div ref={printRef} className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-1">Boletim escolar</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {boletim.school.name} — Ano letivo {boletim.enrollment.year} — {boletim.enrollment.series}
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-6">
          <dt className="text-muted-foreground">Aluno(a)</dt>
          <dd className="font-medium">{boletim.student.name}</dd>
          <dt className="text-muted-foreground">Data de nascimento</dt>
          <dd>{new Date(boletim.student.birthDate).toLocaleDateString('pt-BR')}</dd>
        </dl>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4">Disciplina</th>
              <th className="text-left py-2 pr-2">Carga (h)</th>
              <th className="text-center py-2 px-1">B1</th>
              <th className="text-center py-2 px-1">B2</th>
              <th className="text-center py-2 px-1">B3</th>
              <th className="text-center py-2 px-1">B4</th>
              <th className="text-center py-2 px-1">Rec.</th>
              <th className="text-center py-2 px-1">Média</th>
              <th className="text-center py-2 px-1">Freq.%</th>
            </tr>
          </thead>
          <tbody>
            {boletim.disciplines.map((d) => {
              const b1 = d.bimesters.find((b) => b.bimester === 1);
              const b2 = d.bimesters.find((b) => b.bimester === 2);
              const b3 = d.bimesters.find((b) => b.bimester === 3);
              const b4 = d.bimesters.find((b) => b.bimester === 4);
              const rec = d.bimesters.some((b) => b.recoveryScore != null) ? d.bimesters.find((b) => b.recoveryScore != null)?.recoveryScore : null;
              return (
                <tr key={d.subject} className="border-b">
                  <td className="py-2 pr-4 font-medium">{d.subject}</td>
                  <td className="py-2">{d.workload}</td>
                  <td className="text-center py-2">{b1?.score ?? '-'}</td>
                  <td className="text-center py-2">{b2?.score ?? '-'}</td>
                  <td className="text-center py-2">{b3?.score ?? '-'}</td>
                  <td className="text-center py-2">{b4?.score ?? '-'}</td>
                  <td className="text-center py-2">{rec != null ? rec : '-'}</td>
                  <td className="text-center py-2">{d.avgScore != null ? d.avgScore.toFixed(1) : '-'}</td>
                  <td className="text-center py-2">{d.avgFrequency != null ? d.avgFrequency.toFixed(0) + '%' : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
