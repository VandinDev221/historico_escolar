import { Module } from '@nestjs/common';
import { StudentDocumentsController } from './student-documents.controller';
import { StudentDocumentsService } from './student-documents.service';

@Module({
  controllers: [StudentDocumentsController],
  providers: [StudentDocumentsService],
})
export class StudentDocumentsModule {}
