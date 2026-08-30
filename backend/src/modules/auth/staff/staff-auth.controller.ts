import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { StaffAuthService } from './staff-auth.service';
import { CreateStaffInvitationDto } from '../dto/create-staff-invitation.dto';
import { AcceptStaffInvitationDto } from '../dto/accept-staff-invitation.dto';
import { LoginDto } from '../dto/login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

/**
 * مسارات مصادقة الموظفين - منفصلة تمامًا عن /auth/public.
 * لا يوجد أي Endpoint هنا لإنشاء حساب موظف مباشرة دون دعوة مسبقة.
 */
@Controller('auth/staff')
export class StaffAuthController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Post('invitations')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'users', action: 'manage_staff' })
  createInvitation(@Body() dto: CreateStaffInvitationDto, @Req() req: any) {
    return this.staffAuthService.createInvitation(dto, req.user.sub);
  }

  @Post('accept-invitation')
  acceptInvitation(@Body() dto: AcceptStaffInvitationDto) {
    return this.staffAuthService.acceptInvitation(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.staffAuthService.login(dto);
  }
}
