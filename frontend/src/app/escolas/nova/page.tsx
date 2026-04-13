'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/api';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';

const schema = z.object({
  municipalityId: z.string().min(1, 'Selecione o município'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  code: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Municipality {
  id: string;
  name: string;
  state: string;
}

export default function NovaEscolaPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace('/escolas');
    }
  }, [user, router]);

  const { data: municipalities, isLoading: loadingMunicipalities } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () => fetchWithAuth<Municipality[]>('/municipalities'),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { municipalityId: '', name: '', code: '', address: '' },
  });

  if (user && user.role !== 'SUPER_ADMIN') {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Redirecionando...</p>
      </AppLayout>
    );
  }

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      await fetchWithAuth('/schools', {
        method: 'POST',
        body: JSON.stringify({
          municipalityId: data.municipalityId,
          name: data.name,
          code: data.code || undefined,
          address: data.address || undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['schools'] });
      router.push('/escolas');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao cadastrar escola');
    }
  }

  return (
    <AppLayout>
      <p className="mb-4">
        <Link href="/escolas" className="text-primary hover:underline">← Voltar às escolas</Link>
      </p>
      <h2 className="text-2xl font-semibold mb-6">Cadastrar escola</h2>
        {loadingMunicipalities ? (
          <p className="text-muted-foreground">Carregando municípios...</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Município *</label>
              <select
                {...register('municipalityId')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              >
                <option value="">Selecione...</option>
                {municipalities?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} / {m.state}
                  </option>
                ))}
              </select>
              {errors.municipalityId && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.municipalityId.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nome da escola *</label>
              <input
                {...register('name')}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                placeholder="Ex: EMEF Exemplo"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Código INEP</label>
              <input
                {...register('code')}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input
                {...register('address')}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                placeholder="Opcional"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Cadastrar escola'}
            </button>
          </form>
        )}
    </AppLayout>
  );
}
