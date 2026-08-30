import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CustomRequestsService } from './custom-requests.service';
import { CreateCustomRequestDto } from './dto/create-custom-request.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { RespondToPriceDto } from './dto/respond-to-price.dto';
import { AssignInstructorDto } from './dto/assign-instructor.dto';
import { ReasonNoteDto, QualityReviewDto } from './dto/reason-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('custom-requests')
@UseGuards(JwtAuthGuard)
export class CustomRequestsController {
  constructor(private service: CustomRequestsService) {}

  // ---------- الطالب ----------

  @Post()
  create(@Body() dto: CreateCustomRequestDto, @Req() req: any) {
    return this.service.create(dto, req.user.sub);
  }

  @Post(':id/files/upload-url')
  async requestUploadUrl(
    @Param('id') id: string,
    @Body() body: { filename: string; contentType: string },
    @Req() req: any,
  ) {
    return this.service.createFileUploadUrl(id, body.filename, body.contentType, req.user.sub);
  }

  @Post(':id/files')
  addFile(@Param('id') id: string, @Body() body: { fileKey: string; fileType: string }, @Req() req: any) {
    // الطالب يرفع مباشرة إلى S3/R2 عبر uploadUrl من /files/upload-url أعلاه،
    // ثم يُبلِّغ الـ Backend هنا بـ fileKey النهائي فقط (وليس fileUrl خامًا مباشرًا -
    // كان هذا TODO(production) صريحًا سابقًا).
    return this.service.addFile(id, body.fileKey, body.fileType, req.user.sub);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() req: any) {
    return this.service.submit(id, req.user);
  }

  @Post(':id/respond-to-price')
  respondToPrice(@Param('id') id: string, @Body() dto: RespondToPriceDto, @Req() req: any) {
    return this.service.respondToPrice(id, dto, req.user);
  }

  @Post(':id/confirm-delivery')
  confirmDelivery(@Param('id') id: string, @Req() req: any) {
    return this.service.confirmDelivery(id, req.user);
  }

  @Post(':id/dispute')
  dispute(@Param('id') id: string, @Body() dto: ReasonNoteDto, @Req() req: any) {
    return this.service.dispute(id, dto.message, req.user);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.service.cancel(id, req.user);
  }

  @Get(':id/timeline')
  timeline(@Param('id') id: string) {
    return this.service.getTimeline(id);
  }

  @Get(':id')
  getDetails(@Param('id') id: string) {
    return this.service.getDetails(id);
  }

  // ---------- المدرب المُسند ----------

  @Post(':id/start')
  startProduction(@Param('id') id: string, @Req() req: any) {
    return this.service.startProduction(id, req.user);
  }

  @Post(':id/submit-for-review')
  submitForReview(@Param('id') id: string, @Req() req: any) {
    return this.service.submitForReview(id, req.user);
  }

  @Post(':id/resubmit')
  resubmit(@Param('id') id: string, @Req() req: any) {
    return this.service.resubmit(id, req.user);
  }

  // ---------- الإدارة (requests_reviewer / content_admin / super_admin) ----------

  @Get('admin/list')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'custom_requests', action: 'review' })
  listForReview(@Query('status') status?: string) {
    return this.service.listForReview(status);
  }

  @Post(':id/request-clarification')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'custom_requests', action: 'review' })
  requestClarification(@Param('id') id: string, @Body() dto: ReasonNoteDto, @Req() req: any) {
    return this.service.requestClarification(id, dto.message, req.user);
  }

  @Post(':id/set-price')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'custom_requests', action: 'price' })
  setPrice(@Param('id') id: string, @Body() dto: SetPriceDto, @Req() req: any) {
    return this.service.setPrice(id, dto, req.user);
  }

  @Post(':id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'custom_requests', action: 'review' })
  reject(@Param('id') id: string, @Body() dto: ReasonNoteDto, @Req() req: any) {
    return this.service.reject(id, dto.message, req.user);
  }

  @Post(':id/assign')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'custom_requests', action: 'assign' })
  assign(@Param('id') id: string, @Body() dto: AssignInstructorDto, @Req() req: any) {
    return this.service.assign(id, dto, req.user);
  }

  @Post(':id/quality-review')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'custom_requests', action: 'review' })
  qualityReview(@Param('id') id: string, @Body() dto: QualityReviewDto, @Req() req: any) {
    return this.service.qualityReview(id, dto, req.user);
  }

  @Post(':id/resolve-dispute')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'custom_requests', action: 'approve_final' })
  resolveDispute(
    @Param('id') id: string,
    @Body() body: { resolution: 'reopen_production' | 'partial_refund' | 'full_refund' | 'mark_completed' },
    @Req() req: any,
  ) {
    return this.service.resolveDispute(id, body.resolution, req.user);
  }
}
