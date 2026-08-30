import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { InstructorApprovalService } from './instructor-approval.service';
import { RejectInstructorDto } from './dto/reject-instructor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('admin/instructors')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ resource: 'users', action: 'approve_instructor' })
export class InstructorApprovalController {
  constructor(private service: InstructorApprovalService) {}

  @Get('pending')
  listPending() {
    return this.service.listPending();
  }

  @Post(':userId/approve')
  approve(@Param('userId') userId: string, @Req() req: any) {
    return this.service.approve(userId, req.user.sub);
  }

  @Post(':userId/reject')
  reject(@Param('userId') userId: string, @Body() dto: RejectInstructorDto, @Req() req: any) {
    return this.service.reject(userId, req.user.sub, dto.reason);
  }
}
