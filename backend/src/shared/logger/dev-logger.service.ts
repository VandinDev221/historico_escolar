import { Injectable } from '@nestjs/common';

export type LogLevel = 'info' | 'warn' | 'error' | 'http';

export type SuspiciousCategory = 'sql_injection' | 'path_traversal' | 'invasao' | 'xss';

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userId?: string;
  /** Preenchido quando a requisição parece suspeita (SQLi, path traversal, etc.) */
  suspiciousCategory?: SuspiciousCategory;
  suspiciousReason?: string;
  extra?: Record<string, unknown>;
}

const MAX_LOGS = 2000;
const ID = () => Math.random().toString(36).slice(2, 11);

@Injectable()
export class DevLoggerService {
  private readonly buffer: LogEntry[] = [];
  private listeners: Set<(entry: LogEntry) => void> = new Set();

  private push(entry: LogEntry) {
    entry.id = entry.id || ID();
    this.buffer.push(entry);
    if (this.buffer.length > MAX_LOGS) this.buffer.shift();
    this.listeners.forEach((fn) => fn(entry));
  }

  log(level: LogLevel, message: string, meta?: Partial<Omit<LogEntry, 'id' | 'ts' | 'level' | 'message'>>) {
    this.push({
      id: ID(),
      ts: Date.now(),
      level,
      message,
      ...meta,
    });
  }

  http(meta: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    ip?: string;
    userId?: string;
    suspiciousCategory?: SuspiciousCategory;
    suspiciousReason?: string;
  }) {
    this.push({
      id: ID(),
      ts: Date.now(),
      level: 'http',
      message: `${meta.method} ${meta.path} ${meta.statusCode} ${meta.durationMs}ms`,
      ...meta,
    });
  }

  getRecent(limit = 500): LogEntry[] {
    return this.buffer.slice(-limit);
  }

  subscribe(cb: (entry: LogEntry) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  clear() {
    this.buffer.length = 0;
  }
}
