import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsOptional, Min, Max } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ example: 2024 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ example: '1º Ano' })
  @IsString()
  series: string;

  @ApiProperty({ example: 'CURSANDO', enum: ['CURSANDO', 'CONCLUIDO', 'TRANSFERIDO', 'EVADIDO'] })
  @IsOptional()
  @IsString()
  situation?: 'CURSANDO' | 'CONCLUIDO' | 'TRANSFERIDO' | 'EVADIDO';

  @ApiPropertyOptional({ description: 'ID da turma (sala) para vincular a matrícula' })
  @IsOptional()
  @IsString()
  turmaId?: string;
}
