'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fetchWithAuth } from '@/lib/api';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  birthDate: z.string().min(1, 'Data de nascimento obrigatória'),
  rg: z.string().optional(),
  cpf: z.string().optional(),
  nis: z.string().optional(),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  responsavelNome: z.string().min(2, 'Nome do responsável é obrigatório'),
  responsavelTelefone: z.string().optional(),
  responsavelEmail: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NovoAlunoPage() {
  const router = useRouter();
  const params = useParams();
  const schoolId = params.id as string;
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      birthDate: '',
      rg: '',
      cpf: '',
      nis: '',
      address: '',
      neighborhood: '',
      responsavelNome: '',
      responsavelTelefone: '',
      responsavelEmail: '',
    },
  });

  async function onSubmit(data: FormData) {
    setError(null);
    const { responsavelNome, responsavelTelefone, responsavelEmail, ...studentData } = data;
    const payload = {
      ...studentData,
      contacts: [
        {
          name: responsavelNome,
          phone: responsavelTelefone || undefined,
          email: responsavelEmail || undefined,
          isPrimary: true,
        },
      ],
    };
    try {
      await fetchWithAuth(`/schools/${schoolId}/students`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      router.push(`/escolas/${schoolId}/alunos`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao cadastrar');
    }
  }

  return (
    <AppLayout>
      <p className="mb-4">
        <Link href={`/escolas/${schoolId}/alunos`} className="text-primary hover:underline">← Voltar aos alunos</Link>
      </p>
      <h2 className="text-2xl font-semibold mb-6">Novo aluno</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Nome *</label>
            <input
              {...register('name')}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data de nascimento *</label>
            <input
              type="date"
              {...register('birthDate')}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
            {errors.birthDate && (
              <p className="mt-1 text-sm text-destructive">{errors.birthDate.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">RG</label>
            <input
              {...register('rg')}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">CPF</label>
            <input
              {...register('cpf')}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">NIS</label>
            <input
              {...register('nis')}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Endereço</label>
            <input
              {...register('address')}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bairro</label>
            <input
              {...register('neighborhood')}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Para relatórios por região"
            />
          </div>

          <div className="border-t pt-6 mt-6">
            <h3 className="font-medium mb-3">Responsável pelo aluno</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome do responsável *</label>
                <input
                  {...register('responsavelNome')}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="Ex.: Maria Silva"
                />
                {errors.responsavelNome && (
                  <p className="mt-1 text-sm text-destructive">{errors.responsavelNome.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <input
                  {...register('responsavelTelefone')}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="(19) 99999-9999"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">E-mail</label>
                <input
                  type="email"
                  {...register('responsavelEmail')}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="responsavel@email.com"
                />
                {errors.responsavelEmail && (
                  <p className="mt-1 text-sm text-destructive">{errors.responsavelEmail.message}</p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : 'Cadastrar aluno'}
          </button>
        </form>
    </AppLayout>
  );
}
