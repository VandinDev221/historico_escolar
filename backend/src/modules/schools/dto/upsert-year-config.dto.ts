import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class UpsertYearConfigDto {
  @ApiPropertyOptional({ description: 'Dias letivos (mín. 200 - LDB)', default: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  daysLetivos?: number;

  @ApiPropertyOptional({ description: 'Carga horária anual em horas (800 EF, 1000 EM - LDB)', default: 800 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  cargaHorariaAnual?: number;
}
