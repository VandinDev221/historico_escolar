import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JustifyAbsenceDto {
  @ApiPropertyOptional({ example: 'Atestado médico', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    example: '12345',
    description: 'Doc. do documento do atestado (número ou referência). Fica armazenado na justificativa da falta.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  atestadoDocRef?: string;
}
