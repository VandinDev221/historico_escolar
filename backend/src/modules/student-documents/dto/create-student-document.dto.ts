import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStudentDocumentDto {
  @ApiProperty({ enum: ['RG', 'CPF', 'CERTIDAO_NASCIMENTO', 'FOTO_3X4', 'COMPROVANTE_RESIDENCIA', 'OUTRO'] })
  @IsString()
  type: string;

  @ApiProperty({ example: 'RG - frente' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: '/uploads/alunos/xyz/rg_frente.pdf' })
  @IsString()
  filePath: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsString()
  @IsOptional()
  @MaxLength(128)
  mimeType?: string;

  @ApiPropertyOptional({ example: 102400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}
