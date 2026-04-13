import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { TURNO_VALUES, type TurnoDto } from './create-turma.dto';

export class UpdateTurmaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  series?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name?: string;

  @ApiPropertyOptional({ enum: ['MANHA', 'TARDE', 'NOITE'] })
  @IsOptional()
  @IsEnum(TURNO_VALUES)
  turno?: TurnoDto | null;
}
