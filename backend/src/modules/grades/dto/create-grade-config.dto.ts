import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class CreateGradeConfigDto {
  @ApiProperty({ description: 'Série/ano (ex.: 1º Ano, 2º Ano EF)', example: '1º Ano' })
  @IsString()
  @MinLength(1, { message: 'Informe a série.' })
  @MaxLength(50)
  series: string;

  @ApiProperty({ description: 'Nome da disciplina/matéria', example: 'Matemática' })
  @IsString()
  @MinLength(1, { message: 'Informe o nome da disciplina.' })
  @MaxLength(120)
  subject: string;

  @ApiProperty({ description: 'Carga horária em horas', example: 80 })
  @IsInt()
  @Min(1, { message: 'Carga horária deve ser pelo menos 1 hora.' })
  workload: number;
}
