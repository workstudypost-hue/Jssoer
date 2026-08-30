import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { VideoSecurityService } from './video-security.service';
import { StartPlaybackDto } from './dto/start-playback.dto';
import { ReportSecurityEventDto } from './dto/report-security-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideoSecurityController {
  constructor(private service: VideoSecurityService) {}

  @Post('playback-session')
  startPlayback(@Body() dto: StartPlaybackDto, @Req() req: any) {
    const ipAddress = req.ip;
    return this.service.startPlayback(req.user.sub, dto.lessonId, dto.deviceFingerprint, ipAddress);
  }

  @Post('playback-session/:id/heartbeat')
  heartbeat(@Param('id') sessionId: string, @Req() req: any) {
    return this.service.heartbeat(sessionId, req.user.sub);
  }

  @Post('playback-session/:id/end')
  endPlayback(@Param('id') sessionId: string) {
    return this.service.endPlayback(sessionId);
  }

  @Post('security-events')
  reportEvent(@Body() dto: ReportSecurityEventDto, @Req() req: any) {
    return this.service.reportSecurityEvent(req.user.sub, dto.lessonId, dto.eventType, dto.metadata);
  }
}
