import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { Prisma, UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  schoolId?: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    schoolId: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<LoginResponse['user'] | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.active) return null;
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
    };
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const user = await this.validateUser(email, password);
      if (!user) {
        throw new UnauthorizedException('E-mail ou senha inválidos.');
      }
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId ?? undefined,
      };
      return {
        access_token: this.jwtService.sign(payload),
        user,
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      if (
        e instanceof Prisma.PrismaClientKnownRequestError ||
        e instanceof Prisma.PrismaClientInitializationError ||
        e instanceof Prisma.PrismaClientUnknownRequestError
      ) {
        throw new ServiceUnavailableException(
          'Base de dados indisponível ou a acordar. Tente de novo dentro de instantes.',
        );
      }
      throw e;
    }
  }

  async validatePayload(payload: JwtPayload) {
    return this.usersService.findById(payload.sub);
  }
}
