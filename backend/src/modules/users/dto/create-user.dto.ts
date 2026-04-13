import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'usuario@escola.gov.br' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @ApiProperty({ example: 'senha123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres.' })
  password: string;

  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres.' })
  name: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole, { message: 'Perfil inválido.' })
  role: UserRole;

  @ApiPropertyOptional({ description: 'ID da escola (obrigatório para perfis não Super Admin)' })
  @IsOptional()
  @IsString()
  schoolId?: string | null;

  @ApiPropertyOptional({
    description: 'IDs das disciplinas (GradeConfig) que o professor leciona — apenas para role PROFESSOR',
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  gradeConfigIds?: string[];
}
