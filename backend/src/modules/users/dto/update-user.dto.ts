import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, IsEmail, IsEnum, IsBoolean } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'usuario@escola.gov.br' })
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string;

  @ApiPropertyOptional({ example: 'novaSenha123', minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres.' })
  password?: string;

  @ApiPropertyOptional({ example: 'Maria Silva' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres.' })
  name?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Perfil inválido.' })
  role?: UserRole;

  @ApiPropertyOptional({ description: 'ID da escola (null para Super Admin)' })
  @IsOptional()
  schoolId?: string | null;

  @ApiPropertyOptional({ description: 'Usuário ativo' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'IDs das disciplinas (GradeConfig) que o professor leciona — apenas para role PROFESSOR',
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  gradeConfigIds?: string[];
}
