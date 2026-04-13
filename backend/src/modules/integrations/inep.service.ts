import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Integração com APIs governamentais (INEP / Censo Escolar).
 * Com INEP_API_KEY configurado, chama a API real (INEP_API_URL).
 * Sem chave, retorna dados mock para desenvolvimento.
 * API pública INEP: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos
 */
@Injectable()
export class InepService {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('INEP_API_URL', 'https://api-publica.inep.gov.br').replace(/\/$/, '');
    this.apiKey = this.config.get<string>('INEP_API_KEY');
  }

  /**
   * Busca dados de escola pelo código INEP (código da escola no censo).
   * Com INEP_API_KEY: chama a API real. Sem chave: retorna mock.
   */
  async getSchoolByInepCode(code: string): Promise<{ code: string; name: string; address?: string } | null> {
    if (!this.apiKey) {
      return { code, name: `Escola INEP ${code}`, address: undefined };
    }
    try {
      const url = `${this.baseUrl}/escolas/${encodeURIComponent(code)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      return {
        code: (data.codigo as string) ?? (data.co_entidade as string) ?? code,
        name: (data.nome as string) ?? (data.nomeEscola as string) ?? (data.no_entidade as string) ?? '',
        address: (data.endereco as string) ?? (data.logradouro as string) ?? (data.ds_endereco as string),
      };
    } catch {
      return null;
    }
  }

  /**
   * Verifica se a integração com INEP está configurada.
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
