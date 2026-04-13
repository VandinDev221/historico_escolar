'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { isDevLogsApiEnabled } from '@/lib/devLogsApiAvailability';
import Link from 'next/link';

function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const state = useAuthStore.getState();
    if (state.user != null || state.token != null) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return () => {
      unsub?.();
    };
  }, []);
  return hydrated;
}

type SuspiciousCategory = 'sql_injection' | 'path_traversal' | 'invasao' | 'xss';

interface LogEntry {
  id: string;
  ts: number;
  level: string;
  message: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userId?: string;
  suspiciousCategory?: SuspiciousCategory;
  suspiciousReason?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  http: 'text-blue-400',
  info: 'text-zinc-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const SUSPICIOUS_LABELS: Record<string, string> = {
  sql_injection: 'SQL Injection',
  path_traversal: 'Path traversal',
  invasao: 'Tentativa invasão',
  xss: 'XSS',
};

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SIMULATE_ATTACKS: { label: string; url: string; desc: string }[] = [
  { label: 'WordPress', url: '/api/wp-admin', desc: 'Tentativa WordPress' },
  { label: 'SQLi (OR 1=1)', url: '/api/schools?id=1%20OR%201=1', desc: 'SQL Injection' },
  { label: 'Path traversal', url: '/api/../.env', desc: 'Acesso .env' },
  { label: '.git', url: '/api/.git/config', desc: 'Acesso .git' },
  { label: 'UNION SELECT', url: '/api/auth/login?user=1%20UNION%20SELECT', desc: 'SQLi UNION' },
];

function LogLine({
  entry,
  onCopyIp,
  onBlockIp,
  blockedIps,
}: {
  entry: LogEntry;
  onCopyIp: (ip: string) => void;
  onBlockIp: (ip: string) => void;
  blockedIps: Set<string>;
}) {
  const ip = entry.ip ?? '';
  const isBlocked = ip && blockedIps.has(ip);

  return (
    <li
      className={`flex flex-wrap items-baseline gap-2 py-1.5 px-2 rounded border-b border-zinc-800/50 group ${
        entry.suspiciousReason ? 'bg-red-950/30 border-red-900/50' : ''
      }`}
    >
      <span className="text-zinc-500 shrink-0">
        {new Date(entry.ts).toLocaleTimeString('pt-BR', { hour12: false })}.{String(entry.ts % 1000).padStart(3, '0')}
      </span>
      <span className={`shrink-0 font-medium ${LEVEL_COLORS[entry.level] ?? 'text-zinc-400'}`}>
        [{entry.level.toUpperCase()}]
      </span>
      {entry.suspiciousReason && (
        <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold bg-red-900/60 text-red-200">
          ⚠ {entry.suspiciousCategory ? SUSPICIOUS_LABELS[entry.suspiciousCategory] : 'Suspeito'}: {entry.suspiciousReason}
        </span>
      )}
      {entry.method != null && (
        <span className="text-cyan-400 shrink-0">
          {entry.method} {entry.path}
        </span>
      )}
      {entry.statusCode != null && (
        <span className={entry.statusCode >= 400 ? 'text-red-400' : 'text-green-400'}>
          {entry.statusCode}
        </span>
      )}
      {entry.durationMs != null && <span className="text-amber-400">{entry.durationMs}ms</span>}
      {entry.ip && (
        <span className="text-zinc-500 flex items-center gap-1">
          {entry.ip}
          {isBlocked && <span className="text-red-400 text-[10px]">(bloqueado)</span>}
          <span className="opacity-0 group-hover:opacity-100 flex gap-1">
            <button
              type="button"
              onClick={() => onCopyIp(entry.ip!)}
              className="px-1 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-[10px]"
            >
              Copiar IP
            </button>
            {!isBlocked && (
              <button
                type="button"
                onClick={() => onBlockIp(entry.ip!)}
                className="px-1 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-[10px]"
              >
                Bloquear
              </button>
            )}
          </span>
        </span>
      )}
      <span className="break-all text-zinc-300">{entry.message}</span>
    </li>
  );
}

export default function DevLogsPage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [tab, setTab] = useState<'todos' | 'por-ip' | 'suspeitos'>('todos');
  const [expandedIps, setExpandedIps] = useState<Set<string>>(new Set());
  const [filterIp, setFilterIp] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [showSimulate, setShowSimulate] = useState(false);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [blockFeedback, setBlockFeedback] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    const ips = new Set(logs.map((e) => e.ip).filter(Boolean));
    const suspicious = logs.filter((e) => e.suspiciousReason);
    const authFailures = logs.filter((e) => e.statusCode === 401 || e.statusCode === 403);
    const errors = logs.filter((e) => (e.statusCode ?? 0) >= 500);
    return {
      total: logs.length,
      ips: ips.size,
      suspicious: suspicious.length,
      authFailures: authFailures.length,
      errors: errors.length,
    };
  }, [logs]);

  const ipOptions = useMemo(() => {
    const set = new Set(logs.map((e) => e.ip).filter(Boolean));
    return Array.from(set).sort();
  }, [logs]);

  const applyFilters = (list: LogEntry[]) => {
    let out = list;
    if (filterIp) out = out.filter((e) => (e.ip ?? '') === filterIp);
    if (filterCategory) out = out.filter((e) => (e.suspiciousCategory ?? '') === filterCategory);
    if (filterStatus === '4xx') out = out.filter((e) => (e.statusCode ?? 0) >= 400 && (e.statusCode ?? 0) < 500);
    else if (filterStatus === '5xx') out = out.filter((e) => (e.statusCode ?? 0) >= 500);
    else if (filterStatus === '2xx') out = out.filter((e) => (e.statusCode ?? 0) >= 200 && (e.statusCode ?? 0) < 300);
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      out = out.filter(
        (e) =>
          (e.path ?? '').toLowerCase().includes(q) ||
          (e.message ?? '').toLowerCase().includes(q) ||
          (e.ip ?? '').toLowerCase().includes(q) ||
          (e.suspiciousReason ?? '').toLowerCase().includes(q),
      );
    }
    return out;
  };

  const byIp = useMemo(() => {
    const map: Record<string, LogEntry[]> = {};
    for (const e of logs) {
      const ip = e.ip ?? '(sem IP)';
      if (!map[ip]) map[ip] = [];
      map[ip].push(e);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.ts - b.ts);
    }
    return map;
  }, [logs]);

  const suspiciousLogs = useMemo(() => logs.filter((e) => e.suspiciousReason), [logs]);

  const filteredForTab = useMemo(() => {
    const list = tab === 'suspeitos' ? suspiciousLogs : logs;
    return applyFilters(list);
  }, [tab, logs, suspiciousLogs, filterIp, filterCategory, filterStatus, filterSearch]);

  const todosCount = useMemo(() => applyFilters(logs).length, [logs, filterIp, filterCategory, filterStatus, filterSearch]);
  const suspeitosCount = useMemo(() => applyFilters(suspiciousLogs).length, [suspiciousLogs, filterIp, filterCategory, filterStatus, filterSearch]);

  const filteredByIp = useMemo(() => {
    const base = Object.entries(byIp).filter(([ip]) => !filterIp || ip === filterIp);
    const categoryFilter = (arr: LogEntry[]) =>
      filterCategory ? arr.filter((e) => (e.suspiciousCategory ?? '') === filterCategory) : arr;
    const statusFilter = (arr: LogEntry[]) => {
      if (filterStatus === '4xx') return arr.filter((e) => (e.statusCode ?? 0) >= 400 && (e.statusCode ?? 0) < 500);
      if (filterStatus === '5xx') return arr.filter((e) => (e.statusCode ?? 0) >= 500);
      if (filterStatus === '2xx') return arr.filter((e) => (e.statusCode ?? 0) >= 200 && (e.statusCode ?? 0) < 300);
      return arr;
    };
    const searchFilter = (arr: LogEntry[]) => {
      if (!filterSearch.trim()) return arr;
      const q = filterSearch.trim().toLowerCase();
      return arr.filter(
        (e) =>
          (e.path ?? '').toLowerCase().includes(q) ||
          (e.message ?? '').toLowerCase().includes(q) ||
          (e.suspiciousReason ?? '').toLowerCase().includes(q),
      );
    };
    return base.map(([ip, entries]) => [ip, searchFilter(statusFilter(categoryFilter(entries)))] as const);
  }, [byIp, filterIp, filterCategory, filterStatus, filterSearch]);

  const blockedSet = useMemo(() => new Set(blockedIps), [blockedIps]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'SUPER_ADMIN') {
      router.replace('/');
      return;
    }
  }, [hydrated, user, router]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/dev/logs', { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlocklist = async () => {
    try {
      const res = await fetch('/api/dev/blocklist', { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setBlockedIps(Array.isArray(data?.ips) ? data.ips : []);
    } catch {
      setBlockedIps([]);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    if (!isDevLogsApiEnabled || user?.role !== 'SUPER_ADMIN') {
      setLoading(false);
      return;
    }
    fetchLogs();
    fetchBlocklist();
    if (!autoRefresh) return;
    const t = setInterval(() => {
      fetchLogs();
      fetchBlocklist();
    }, 1500);
    return () => clearInterval(t);
  }, [autoRefresh, hydrated, user?.role]);

  useEffect(() => {
    if (autoRefresh && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs, autoRefresh]);

  const clearLogs = async () => {
    if (!isDevLogsApiEnabled) return;
    await fetch('/api/dev/logs/clear', { method: 'GET', headers: getAuthHeaders() });
    setLogs([]);
  };

  const toggleIp = (ip: string) => {
    setExpandedIps((prev) => {
      const next = new Set(prev);
      if (next.has(ip)) next.delete(ip);
      else next.add(ip);
      return next;
    });
  };

  const copyIp = (ip: string) => {
    navigator.clipboard?.writeText(ip);
  };

  const blockIp = async (ip: string) => {
    if (!isDevLogsApiEnabled) return;
    if (!ip || !confirm(`Bloquear o IP ${ip}? Ele deixará de acessar a API até você desbloquear.`)) return;
    setBlockFeedback(null);
    try {
      const res = await fetch('/api/dev/block-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ip }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok !== false) {
        setBlockedIps(Array.isArray(data.ips) ? data.ips : [...blockedIps, ip]);
        setBlockFeedback(`IP ${ip} bloqueado. Novas requisições desse IP receberão 403.`);
        setTimeout(() => setBlockFeedback(null), 5000);
      } else {
        setBlockFeedback(data?.message || `Falha ao bloquear (${res.status}).`);
      }
    } catch (e) {
      setBlockFeedback('Erro de rede ao bloquear IP.');
    }
  };

  const unblockIp = async (ip: string) => {
    if (!isDevLogsApiEnabled) return;
    setBlockFeedback(null);
    try {
      const res = await fetch(`/api/dev/block-ip/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok !== false) {
        setBlockedIps(Array.isArray(data.ips) ? data.ips : []);
        setBlockFeedback(`IP ${ip} desbloqueado.`);
        setTimeout(() => setBlockFeedback(null), 3000);
      } else {
        setBlockFeedback('Falha ao desbloquear.');
      }
    } catch {
      setBlockFeedback('Erro de rede ao desbloquear.');
    }
  };

  const exportCsv = () => {
    const list = tab === 'por-ip' ? filteredByIp.flatMap(([, entries]) => entries) : filteredForTab;
    const headers: (keyof LogEntry)[] = [
      'ts',
      'level',
      'method',
      'path',
      'statusCode',
      'durationMs',
      'ip',
      'suspiciousReason',
      'message',
    ];
    const rows = list.map((e) =>
      headers.map((h) => {
        const v = e[h];
        const s = v == null ? '' : String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','),
    );
    const csv = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dev-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const simulateAttack = async (url: string, label: string) => {
    setSimulating(label);
    try {
      await fetch(url, { headers: getAuthHeaders() });
    } finally {
      setSimulating(null);
      if (isDevLogsApiEnabled) setTimeout(fetchLogs, 300);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        <p>Carregando...</p>
      </div>
    );
  }

  if (user && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito ao desenvolvedor.</p>
      </div>
    );
  }

  if (user?.role === 'SUPER_ADMIN' && !isDevLogsApiEnabled) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col">
        <header className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
          <Link href="/" className="text-sm text-blue-400 hover:underline">
            ← Voltar
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg text-center space-y-3 text-zinc-400">
            <p className="text-zinc-200 font-medium">Logs em tempo real indisponíveis neste ambiente</p>
            <p>
              Neste deploy as rotas <code className="text-amber-400/90">/api/dev/*</code> ficam desligadas no servidor
              (403). A interface não tenta mais buscá-las para evitar ruído no console.
            </p>
            <p className="text-sm">
              Use <code className="text-zinc-300">next dev</code> localmente ou, se precisar do painel contra uma API
              com dev habilitado, defina <code className="text-zinc-300">NEXT_PUBLIC_DEV_API_ENABLED=true</code> no
              build.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-blue-400 hover:underline">
            ← Voltar
          </Link>
          <span className="text-sm font-medium text-amber-400">Dev — Logs em tempo real</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
            Atualizar 1,5s
          </label>
          <button type="button" onClick={fetchLogs} className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600">
            Atualizar
          </button>
          <button type="button" onClick={exportCsv} className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600">
            Exportar CSV
          </button>
          <button type="button" onClick={clearLogs} className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800/50 text-red-300">
            Limpar
          </button>
        </div>
      </header>

      {/* Resumo */}
      <section className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Resumo</h2>
        <div className="flex flex-wrap gap-4">
          <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
            <span className="text-zinc-400 text-xs">Requisições</span>
            <p className="text-lg font-mono text-white">{stats.total}</p>
          </div>
          <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
            <span className="text-zinc-400 text-xs">IPs únicos</span>
            <p className="text-lg font-mono text-white">{stats.ips}</p>
          </div>
          <div className="rounded-lg bg-amber-900/40 border border-amber-700/50 px-3 py-2">
            <span className="text-amber-300 text-xs">Auth (401/403)</span>
            <p className="text-lg font-mono text-amber-200">{stats.authFailures}</p>
          </div>
          <div className="rounded-lg bg-red-900/40 border border-red-700/50 px-3 py-2">
            <span className="text-red-300 text-xs">Eventos suspeitos</span>
            <p className="text-lg font-mono text-red-200">{stats.suspicious}</p>
          </div>
          {stats.errors > 0 && (
            <div className="rounded-lg bg-red-950/60 border border-red-800 px-3 py-2">
              <span className="text-red-400 text-xs">Erros 5xx</span>
              <p className="text-lg font-mono text-red-300">{stats.errors}</p>
            </div>
          )}
          {blockedIps.length > 0 && (
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2 border border-zinc-600">
              <span className="text-zinc-400 text-xs">IPs bloqueados</span>
              <p className="text-lg font-mono text-white">{blockedIps.length}</p>
            </div>
          )}
        </div>
      </section>

      {/* Simular ataque */}
      <section className="border-b border-zinc-800 px-4 py-2">
        <button
          type="button"
          onClick={() => setShowSimulate((s) => !s)}
          className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-2"
        >
          {showSimulate ? '▼' : '▶'} Simular ataque (gerar requisições suspeitas para testar detecção)
        </button>
        {showSimulate && (
          <div className="mt-2 flex flex-wrap gap-2">
            {SIMULATE_ATTACKS.map(({ label, url, desc }) => (
              <button
                key={url}
                type="button"
                onClick={() => simulateAttack(url, label)}
                disabled={!!simulating}
                className="px-3 py-1.5 rounded bg-red-900/40 hover:bg-red-800/50 border border-red-700/50 text-red-200 text-sm"
                title={desc}
              >
                {simulating === label ? '...' : label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Filtros */}
      <section className="border-b border-zinc-800 px-4 py-2 flex flex-wrap items-center gap-3">
        <span className="text-xs text-zinc-500 font-medium">Filtros:</span>
        <select
          value={filterIp}
          onChange={(e) => setFilterIp(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
        >
          <option value="">Todos os IPs</option>
          {ipOptions.map((ip) => (
            <option key={ip} value={ip}>{ip}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
        >
          <option value="">Todas as categorias</option>
          <option value="sql_injection">SQL Injection</option>
          <option value="path_traversal">Path traversal</option>
          <option value="invasao">Tentativa invasão</option>
          <option value="xss">XSS</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
        >
          <option value="">Todos os status</option>
          <option value="2xx">2xx</option>
          <option value="4xx">4xx</option>
          <option value="5xx">5xx</option>
        </select>
        <input
          type="text"
          placeholder="Buscar (path, IP, mensagem...)"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 min-w-[180px]"
        />
        {(filterIp || filterCategory || filterStatus || filterSearch) && (
          <button
            type="button"
            onClick={() => {
              setFilterIp('');
              setFilterCategory('');
              setFilterStatus('');
              setFilterSearch('');
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Limpar filtros
          </button>
        )}
      </section>

      {/* Feedback bloqueio */}
      {blockFeedback && (
        <section className="border-b border-zinc-800 px-4 py-2 bg-amber-950/40 border-l-4 border-amber-600 text-amber-200 text-sm">
          {blockFeedback}
        </section>
      )}

      {/* IPs bloqueados */}
      {blockedIps.length > 0 && (
        <section className="border-b border-zinc-800 px-4 py-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium">IPs bloqueados (recebem 403):</span>
          {blockedIps.map((ip) => (
            <span key={ip} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/50 text-red-200 text-sm">
              {ip}
              <button type="button" onClick={() => unblockIp(ip)} className="hover:text-white" title="Desbloquear">
                ×
              </button>
            </span>
          ))}
        </section>
      )}

      {/* Medidas recomendadas */}
      <section className="border-b border-zinc-800 bg-zinc-900/30 px-4 py-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Medidas recomendadas</h2>
        <ul className="text-sm text-zinc-400 space-y-1 list-disc list-inside">
          <li>Use <strong>Filtros</strong> para ver apenas um IP, categoria (ex.: SQL Injection) ou status (4xx/5xx).</li>
          <li>Em cada log: <strong>Copiar IP</strong> ou <strong>Bloquear IP</strong> (o IP deixa de acessar a API até desbloquear).</li>
          <li><strong>Exportar CSV</strong> para análise externa ou relatório (respeita filtros e aba atual).</li>
          {stats.suspicious > 0 && (
            <li className="text-amber-300">Há eventos suspeitos: revise na aba Suspeitos, bloqueie IPs mal-intencionados e considere regras no firewall/WAF em produção.</li>
          )}
          {stats.authFailures > 0 && (
            <li className="text-amber-200">Muitos 401/403 podem ser tentativas de acesso não autorizado; filtre por status 4xx e analise por IP.</li>
          )}
        </ul>
      </section>

      {/* Abas */}
      <div className="border-b border-zinc-800 px-4 flex gap-2">
        {(['todos', 'por-ip', 'suspeitos'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'todos' && `Todos (${todosCount})`}
            {t === 'por-ip' && `Por IP (${stats.ips})`}
            {t === 'suspeitos' && `Suspeitos (${suspeitosCount})`}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-auto p-4 font-mono text-xs">
        {loading ? (
          <p className="text-zinc-500">Carregando...</p>
        ) : tab === 'todos' && filteredForTab.length === 0 ? (
          <p className="text-zinc-500">
            Nenhum log {filterIp || filterCategory || filterStatus || filterSearch ? 'com os filtros aplicados' : ''}. Use &quot;Simular ataque&quot; para gerar requisições de teste.
          </p>
        ) : tab === 'por-ip' && filteredByIp.length === 0 ? (
          <p className="text-zinc-500">Nenhum log para agrupar por IP.</p>
        ) : tab === 'suspeitos' && filteredForTab.length === 0 ? (
          <p className="text-zinc-500">Nenhum evento suspeito. Clique em &quot;Simular ataque&quot; para testar.</p>
        ) : (
          <>
            {tab === 'todos' && (
              <ul className="space-y-0">
                {filteredForTab.map((entry) => (
                  <LogLine
                    key={entry.id}
                    entry={entry}
                    onCopyIp={copyIp}
                    onBlockIp={blockIp}
                    blockedIps={blockedSet}
                  />
                ))}
              </ul>
            )}
            {tab === 'por-ip' && (
              <div className="space-y-3">
                {filteredByIp
                  .filter(([, entries]) => entries.length > 0)
                  .sort(([, a], [, b]) => b.length - a.length)
                  .map(([ip, entries]) => {
                    const open = expandedIps.has(ip);
                    const suspiciousCount = entries.filter((e) => e.suspiciousReason).length;
                    return (
                      <div key={ip} className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleIp(ip)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-800/50"
                        >
                          <span className="font-medium text-cyan-400">{ip}</span>
                          <span className="text-zinc-500">
                            {entries.length} req.
                            {suspiciousCount > 0 && (
                              <span className="ml-2 text-red-400">⚠ {suspiciousCount} suspeito(s)</span>
                            )}
                          </span>
                          <span className="text-zinc-600">{open ? '▼' : '▶'}</span>
                        </button>
                        {open && (
                          <ul className="border-t border-zinc-800 max-h-80 overflow-y-auto">
                            {entries.map((entry) => (
                              <LogLine
                                key={entry.id}
                                entry={entry}
                                onCopyIp={copyIp}
                                onBlockIp={blockIp}
                                blockedIps={blockedSet}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
            {tab === 'suspeitos' && (
              <ul className="space-y-0">
                {filteredForTab.map((entry) => (
                  <LogLine
                    key={entry.id}
                    entry={entry}
                    onCopyIp={copyIp}
                    onBlockIp={blockIp}
                    blockedIps={blockedSet}
                  />
                ))}
              </ul>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </main>
    </div>
  );
}
