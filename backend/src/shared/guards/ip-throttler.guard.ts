import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip =
      (typeof req.ip === 'string' && req.ip) ||
      (typeof req.connection?.remoteAddress === 'string' && req.connection.remoteAddress) ||
      (typeof req.socket?.remoteAddress === 'string' && req.socket.remoteAddress) ||
      'unknown';

    // Normaliza IPv4 mapeado em IPv6 (ex: ::ffff:127.0.0.1)
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  }
}

