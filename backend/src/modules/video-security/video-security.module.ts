import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VideoSecurityController } from './video-security.controller';
import { VideoSecurityService } from './video-security.service';
import { SecurityReviewModule } from '../security-review/security-review.module';
import { MuxAdapter } from './mux.adapter';
import { GeoIpService } from './geoip.service';

@Module({
  imports: [JwtModule.register({}), SecurityReviewModule],
  controllers: [VideoSecurityController],
  providers: [VideoSecurityService, MuxAdapter, GeoIpService],
  exports: [VideoSecurityService],
})
export class VideoSecurityModule {}
