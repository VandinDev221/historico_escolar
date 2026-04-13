import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MunicipalitiesModule } from './modules/municipalities/municipalities.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { StudentsModule } from './modules/students/students.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { GradesModule } from './modules/grades/grades.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { HealthModule } from './modules/health/health.module';
import { StudentDocumentsModule } from './modules/student-documents/student-documents.module';
import { DevModule } from './modules/dev/dev.module';
import { SearchModule } from './modules/search/search.module';
import { TurmasModule } from './modules/turmas/turmas.module';
import { RootController } from './root.controller';
import { APP_FILTER } from '@nestjs/core';
import { IpThrottlerGuard } from './shared/guards/ip-throttler.guard';
import { DevLogMiddleware } from './shared/logger/dev-log.middleware';
import { DevLogExceptionFilter } from './shared/logger/dev-log-exception.filter';

@Module({
  controllers: [RootController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => {
        const ttlMs = Number.parseInt(process.env.RATE_LIMIT_TTL_MS ?? '60000', 10);
        const limit = Number.parseInt(process.env.RATE_LIMIT_LIMIT ?? '120', 10);
        const blockDurationMs = Number.parseInt(
          process.env.RATE_LIMIT_BLOCK_DURATION_MS ?? '0',
          10,
        );

        return [
          {
            ttl: Number.isFinite(ttlMs) ? ttlMs : 60000,
            limit: Number.isFinite(limit) ? limit : 120,
            blockDuration: Number.isFinite(blockDurationMs) ? blockDurationMs : 0,
          },
        ];
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    MunicipalitiesModule,
    SchoolsModule,
    StudentsModule,
    EnrollmentsModule,
    GradesModule,
    ReportsModule,
    DocumentsModule,
    IntegrationsModule,
    HealthModule,
    StudentDocumentsModule,
    DevModule,
    SearchModule,
    TurmasModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: IpThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: DevLogExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DevLogMiddleware).forRoutes('*');
  }
}
