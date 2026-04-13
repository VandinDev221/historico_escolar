import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MunicipalitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.municipality.findMany({
      orderBy: [{ state: 'asc' }, { name: 'asc' }],
    });
  }
}
