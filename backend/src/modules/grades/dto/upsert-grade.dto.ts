import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class UpsertGradeDto {
  @ApiProperty({ description: 'Bimestre (1 a 4)', example: 1 })
  @IsInt()
  @Min(1)
  @Max(4)
  bimester: number;

  @ApiPropertyOptional({ description: 'Nota 1 (0-10)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score1?: number;

  @ApiPropertyOptional({ description: 'Nota 2 (0-10)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score2?: number;

  @ApiPropertyOptional({ description: 'Nota 3 (0-10)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score3?: number;

  @ApiPropertyOptional({ description: 'Nota 4 (0-10)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score4?: number;

  /** Nota única (compatibilidade): se enviado sem score1..4, usa como única nota e média */
  @ApiPropertyOptional({ description: 'Nota única (0-10) — usado quando não envia N1..N4' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score?: number;

  @ApiPropertyOptional({ description: 'Frequência (0-40)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  frequency?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  recoveryScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}
