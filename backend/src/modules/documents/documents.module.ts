import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PdfGeneratorService } from './pdf-generator.service';
import { SchoolsModule } from '../schools/schools.module';

@Module({
  imports: [SchoolsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, PdfGeneratorService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
