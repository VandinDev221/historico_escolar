'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center p-6">
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 max-w-lg w-full text-destructive">
        <h2 className="text-lg font-semibold mb-2">Ocorreu um erro</h2>
        <p className="text-sm font-mono break-words bg-background/50 p-3 rounded mt-2">
          {error.message}
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Se o problema continuar, recarregue a página ou tente novamente mais tarde.
        </p>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Ir para início
        </Link>
      </div>
    </div>
  );
}
