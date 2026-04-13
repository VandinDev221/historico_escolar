import { Injectable } from '@nestjs/common';

/**
 * Lista de IPs bloqueados pelo painel de dev (em memória; reinicia com o servidor).
 */
@Injectable()
export class DevBlocklistService {
  private readonly blocked = new Set<string>();

  has(ip: string): boolean {
    return ip ? this.blocked.has(ip.trim()) : false;
  }

  add(ip: string): void {
    const t = ip?.trim();
    if (t) this.blocked.add(t);
  }

  remove(ip: string): void {
    if (ip?.trim()) this.blocked.delete(ip.trim());
  }

  list(): string[] {
    return Array.from(this.blocked);
  }
}
