import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SecurityReviewService } from './security-review.service';
import { ResolveSecurityCaseDto } from './dto/resolve-case.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SecurityCaseType } from '@prisma/client';

@Controller('admin/security-review-queue')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ resource: 'activity_logs', action: 'read' })
export class SecurityReviewController {
  constructor(private service: SecurityReviewService) {}

  @Get()
  list(@Query('caseType') caseType?: SecurityCaseType, @Query('status') status?: string) {
    return this.service.listQueue({ caseType, status });
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Req() req: any) {
    return this.service.assign(id, req.user.sub);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveSecurityCaseDto, @Req() req: any) {
    return this.service.resolve(id, dto.resolution, dto.notes, req.user.sub);
  }
}
