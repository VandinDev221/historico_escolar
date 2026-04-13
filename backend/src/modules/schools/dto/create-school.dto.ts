import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateSchoolDto {
  @ApiProperty({ description: 'ID do município' })
  @IsString()
  @MinLength(1, { message: 'Selecione o município.' })
  municipalityId: string;

  @ApiProperty({ example: 'EMEF Exemplo' })
  @IsString()
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres.' })
  name: string;

  @ApiPropertyOptional({ example: '35000000', description: 'Código INEP' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}
