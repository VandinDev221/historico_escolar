import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateHistoricoDto {
  @ApiProperty({ description: 'ID do aluno' })
  @IsString()
  @IsNotEmpty()
  studentId: string;
}
