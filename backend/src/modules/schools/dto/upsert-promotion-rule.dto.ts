import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpsertPromotionRuleDto {
  @ApiPropertyOptional({ description: 'Ano letivo (null = regra padrão para todos os anos)' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number | null;

  @ApiPropertyOptional({ description: 'Nota mínima para aprovação', default: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  minScore?: number;

  @ApiPropertyOptional({ description: 'Frequência mínima % (LDB Art. 24)', default: 75 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minFrequencyPercent?: number;

  @ApiPropertyOptional({ description: 'Considerar nota de recuperação', default: true })
  @IsOptional()
  @IsBoolean()
  useRecoveryScore?: boolean;
}
