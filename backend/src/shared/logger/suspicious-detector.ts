/**
 * Detecção simples de padrões suspeitos em URL/query (SQL injection, path traversal, etc.).
 * Apenas para painel de dev — não substitui WAF ou validação adequada.
 */

function decodeUri(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

const SQL_PATTERNS = [
  { re: /(\bOR\b|\bAND\b)\s*[\d']*\s*=\s*[\d']*/i, reason: 'OR/AND 1=1 (possível SQLi)' },
  { re: /\bUNION\s+SELECT\b/i, reason: 'UNION SELECT (possível SQLi)' },
  { re: /\bSELECT\s+.*\s+FROM\s+/i, reason: 'SELECT FROM (possível SQLi)' },
  { re: /;\s*DROP\s+TABLE/i, reason: '; DROP TABLE (possível SQLi)' },
  { re: /'\s*OR\s*'/i, reason: "' OR ' (possível SQLi)" },
  { re: /--\s*$|#\s*$/, reason: 'Comentário SQL (-- ou #)' },
  { re: /\bINSERT\s+INTO\b/i, reason: 'INSERT INTO (possível SQLi)' },
  { re: /\bEXEC\s*\(|\bEXECUTE\s+/i, reason: 'EXEC/EXECUTE (possível SQLi)' },
  { re: /\bBENCHMARK\s*\(/i, reason: 'BENCHMARK (possível SQLi)' },
  { re: /(\%27|')(\s*)(\%27|')/i, reason: 'Aspas concatenadas (possível SQLi)' },
];

const PATH_TRAVERSAL = [
  { re: /\.\.\/|\.\.\\/, reason: 'Path traversal (../)' },
  { re: /%2e%2e%2f|%2e%2e\//i, reason: 'Path traversal codificado' },
];

const INVASION_PATTERNS = [
  { re: /wp-admin|wp-login\.php/i, reason: 'Tentativa WordPress' },
  { re: /\.env(\b|$)/i, reason: 'Acesso a .env' },
  { re: /config\.(php|inc)/i, reason: 'Acesso a config' },
  { re: /phpmyadmin|pma\//i, reason: 'phpMyAdmin' },
  { re: /\.git(\/|$)/i, reason: 'Acesso a .git' },
  { re: /\.\.\/\.\.\//, reason: 'Path traversal múltiplo' },
  { re: /<script|javascript:/i, reason: 'Possível XSS' },
  { re: /\badmin\b.*\b--\b|admin'--/i, reason: 'Bypass login admin' },
];

export type SuspiciousCategory = 'sql_injection' | 'path_traversal' | 'invasao' | 'xss';

export interface SuspiciousResult {
  category: SuspiciousCategory;
  reason: string;
}

export function detectSuspicious(method: string, pathAndQuery: string): SuspiciousResult | null {
  const raw = pathAndQuery || '';
  const decoded = decodeUri(raw);

  for (const { re, reason } of SQL_PATTERNS) {
    if (re.test(decoded) || re.test(raw)) return { category: 'sql_injection', reason };
  }
  for (const { re, reason } of PATH_TRAVERSAL) {
    if (re.test(decoded) || re.test(raw)) return { category: 'path_traversal', reason };
  }
  for (const { re, reason } of INVASION_PATTERNS) {
    if (re.test(decoded) || re.test(raw)) return { category: 'invasao', reason };
  }

  return null;
}
