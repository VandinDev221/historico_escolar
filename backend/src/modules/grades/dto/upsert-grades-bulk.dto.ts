import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GradeBulkItemDto {
  @ApiProperty({ description: 'ID da matrícula do aluno' })
  @IsString()
  enrollmentId: string;

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

  @ApiPropertyOptional({ description: 'Frequência (0-40)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  frequency?: number;
}

export class UpsertGradesBulkDto {
  @ApiProperty({ description: 'ID da disciplina (gradeConfig)' })
  @IsString()
  gradeConfigId: string;

  @ApiProperty({ description: 'Bimestre (1 a 4)', example: 1 })
  @IsInt()
  @Min(1)
  @Max(4)
  bimester: number;

  @ApiProperty({
    type: [GradeBulkItemDto],
    description: 'Lista de notas por matrícula (uma por aluno da turma)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeBulkItemDto)
  grades: GradeBulkItemDto[];
}
