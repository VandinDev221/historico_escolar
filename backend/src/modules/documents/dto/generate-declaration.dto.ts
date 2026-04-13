import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class GenerateDeclarationDto {
  @ApiProperty({ enum: ['MATRICULA', 'TRANSFERENCIA', 'CONCLUSAO', 'FREQUENCIA'] })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty()
  @IsString()
  studentId: string;

  @ApiPropertyOptional({ description: 'Obrigatório para TRANSFERENCIA, CONCLUSAO, FREQUENCIA' })
  @IsOptional()
  @IsString()
  enrollmentId?: string;
}
