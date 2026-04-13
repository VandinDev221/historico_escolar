import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InepService } from './inep.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [ConfigModule],
  controllers: [IntegrationsController],
  providers: [InepService],
  exports: [InepService],
})
export class IntegrationsModule {}
