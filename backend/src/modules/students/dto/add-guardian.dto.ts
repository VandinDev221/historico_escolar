import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export const GuardianRelationValues = ['MAE', 'PAI', 'RESPONSAVEL', 'OUTRO'] as const;
export type GuardianRelationDto = (typeof GuardianRelationValues)[number];

export class AddGuardianDto {
  @ApiProperty({ description: 'ID do usuário com perfil PAIS_RESPONSAVEL' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({ enum: GuardianRelationValues })
  @IsOptional()
  @IsEnum(GuardianRelationValues)
  relation?: GuardianRelationDto;

  @ApiPropertyOptional()
  @IsOptional()
  isPrimary?: boolean;
}
