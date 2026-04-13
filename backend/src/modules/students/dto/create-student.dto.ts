import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';

export class StudentContactDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateStudentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres.' })
  name: string;

  @ApiProperty({ example: '2015-05-20' })
  @IsDateString()
  birthDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Bairro (para relatórios por região)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certidaoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comprovanteUrl?: string;

  @ApiPropertyOptional({ type: [StudentContactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentContactDto)
  contacts?: StudentContactDto[];
}
