import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

// pdfkit não exporta tipos adequados para ESM
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

@Injectable()
export class PdfGeneratorService {
  async generateDeclarationPdf(
    content: string,
    validateUrl: string,
    validationCode: string,
    title = 'DECLARAÇÃO',
  ): Promise<Buffer> {
    const qrBuffer = await QRCode.toBuffer(validateUrl, { width: 120, margin: 1 });
    let bodyLines = content.split('\n');
    if (title !== 'DECLARAÇÃO' && bodyLines[0]?.trim() === title) {
      bodyLines = bodyLines.slice(1);
    }
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(11).font('Helvetica');
      const lines = bodyLines;
      for (const line of lines) {
        doc.text(line || ' ', { align: 'left', lineBreak: true });
      }
      doc.moveDown(2);
      doc.fontSize(9).fillColor('#666').text(`Código de validação: ${validationCode}`, { align: 'left' });
      doc.moveDown(1);
      const qrSize = 120;
      const qrX = (doc.page.width - qrSize) / 2;
      const qrY = doc.page.height - 50 - qrSize;
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      doc.fontSize(9).fillColor('#666').text('Escaneie o QR Code para validar este documento.', 0, doc.page.height - 28, {
        width: doc.page.width,
        align: 'center',
      });
      doc.end();
    });
  }
}
