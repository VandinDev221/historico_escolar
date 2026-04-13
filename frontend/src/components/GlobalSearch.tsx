'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { searchGlobal, type GlobalSearchResult } from '@/lib/api';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ['globalSearch', debouncedQuery],
    queryFn: () => searchGlobal(debouncedQuery),
    enabled: debouncedQuery.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  });

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const hasResults = data && (data.schools.length > 0 || data.students.length > 0);
  const showDropdown = open && (query.length >= MIN_QUERY_LENGTH) && (isFetching || hasResults !== undefined);

  const goTo = (path: string) => {
    setOpen(false);
    setQuery('');
    router.push(path);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Buscar escolas e alunos..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          autoComplete="off"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-auto rounded-md border border-border bg-card shadow-lg">
          {isFetching ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>
          ) : debouncedQuery.length < MIN_QUERY_LENGTH ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Digite ao menos 2 caracteres</div>
          ) : !hasResults ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum resultado encontrado</div>
          ) : (
            <SearchResults data={data!} onSelect={goTo} />
          )}
        </div>
      )}
    </div>
  );
}

function SearchResults({ data, onSelect }: { data: GlobalSearchResult; onSelect: (path: string) => void }) {
  return (
    <div className="py-2">
      {data.schools.length > 0 && (
        <div className="px-3 py-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Escolas</p>
          <ul className="mt-1">
            {data.schools.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(`/escolas/${s.id}/alunos`)}
                  className="w-full rounded px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="font-medium">{s.name}</span>
                  {s.code && <span className="ml-2 text-muted-foreground">({s.code})</span>}
                  <span className="ml-2 text-muted-foreground text-xs">
                    {s.municipality.name} / {s.municipality.state}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.students.length > 0 && (
        <div className="px-3 py-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alunos</p>
          <ul className="mt-1">
            {data.students.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(`/escolas/${s.schoolId}/alunos/${s.id}`)}
                  className="w-full rounded px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-muted-foreground text-xs">{s.school.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
