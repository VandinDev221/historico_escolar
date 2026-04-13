import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Nova senha deve ter pelo menos 6 caracteres.' })
  password?: string;

  @ApiPropertyOptional({ description: 'Senha atual (obrigatória ao alterar a senha)' })
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
