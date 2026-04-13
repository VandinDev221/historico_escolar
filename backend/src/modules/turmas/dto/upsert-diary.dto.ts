import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DiaryRecordDto {
  @ApiProperty()
  @IsString()
  enrollmentId: string;

  @ApiProperty()
  @IsBoolean()
  present: boolean;
}

export class UpsertDiaryDto {
  @ApiProperty({ description: 'Data do dia letivo (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ type: [DiaryRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiaryRecordDto)
  records: DiaryRecordDto[];
}
