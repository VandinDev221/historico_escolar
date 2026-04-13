import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsEnum, MinLength, MaxLength } from 'class-validator';

export const TURNO_VALUES = ['MANHA', 'TARDE', 'NOITE'] as const;
export type TurnoDto = (typeof TURNO_VALUES)[number];

export class CreateTurmaDto {
  @ApiProperty({ example: 2024 })
  @IsInt()
  year: number;

  @ApiProperty({ description: 'Série ex.: 6º Ano', example: '6º Ano' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  series: string;

  @ApiProperty({ description: 'Nome da turma ex.: 6ºA', example: '6ºA' })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name: string;

  @ApiPropertyOptional({ enum: TURNO_VALUES })
  @IsOptional()
  @IsEnum(TURNO_VALUES)
  turno?: TurnoDto;
}
