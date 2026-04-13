import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class UpdateGradeConfigDto {
  @ApiPropertyOptional({ description: 'Série/ano' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  series?: string;

  @ApiPropertyOptional({ description: 'Nome da disciplina' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  subject?: string;

  @ApiPropertyOptional({ description: 'Carga horária em horas' })
  @IsOptional()
  @IsInt()
  @Min(1)
  workload?: number;
}
