import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddDisciplineDto {
  @ApiProperty({ description: 'ID da GradeConfig (disciplina/série)' })
  @IsString()
  @IsNotEmpty()
  gradeConfigId: string;
}
