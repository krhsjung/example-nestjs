import { Module } from '@nestjs/common';
import { DeepLinkController, WellKnownController } from './deep-link.controller';
import { DeepLinkService } from './deep-link.service';

@Module({
  controllers: [WellKnownController, DeepLinkController],
  providers: [DeepLinkService],
})
export class DeepLinkModule {}
