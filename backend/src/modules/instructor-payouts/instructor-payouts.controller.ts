import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { InstructorPayoutsService } from './instructor-payouts.service';
import { RejectPayoutDto } from './dto/reject-payout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('admin/instructor-payouts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InstructorPayoutsController {
  constructor(private payoutsService: InstructorPayoutsService) {}

  /**
   * الموافقة الأولى - finance_manager.
   * الخدمة نفسها تقرر داخليًا إن كانت الدفعة تحتاج موافقة ثانية أم لا (الحد: 500$).
   */
  @Post(':id/first-approval')
  @RequirePermissions({ resource: 'instructor_payouts', action: 'approve' })
  firstApproval(@Param('id') id: string, @Req() req: any) {
    return this.payoutsService.firstApproval(id, req.user.sub);
  }

  /**
   * الموافقة الثانية - super_admin حصريًا فعليًا الآن عبر صلاحية منفصلة
   * (instructor_payouts.approve_second) لا يملكها finance_manager أبدًا في الـ Seed،
   * بالإضافة لقيد "شخص مختلف عن الموافق الأول" على مستوى الخدمة كطبقة حماية إضافية.
   */
  @Post(':id/second-approval')
  @RequirePermissions({ resource: 'instructor_payouts', action: 'approve_second' })
  secondApproval(@Param('id') id: string, @Req() req: any) {
    return this.payoutsService.secondApproval(id, req.user.sub);
  }

  @Post(':id/reject')
  @RequirePermissions({ resource: 'instructor_payouts', action: 'approve' })
  reject(@Param('id') id: string, @Body() dto: RejectPayoutDto) {
    return this.payoutsService.reject(id, dto.reason);
  }

  @Post(':id/execute')
  @RequirePermissions({ resource: 'instructor_payouts', action: 'approve' })
  execute(@Param('id') id: string) {
    return this.payoutsService.executePayout(id);
  }
}
