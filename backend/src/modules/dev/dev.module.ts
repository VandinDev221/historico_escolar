import { Module } from '@nestjs/common';
import { DevLoggerService } from '../../shared/logger/dev-logger.service';
import { DevBlocklistService } from './dev-blocklist.service';
import { DevController } from './dev.controller';

@Module({
  controllers: [DevController],
  providers: [DevLoggerService, DevBlocklistService],
  exports: [DevLoggerService, DevBlocklistService],
})
export class DevModule {}

