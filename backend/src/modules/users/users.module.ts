import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { InstructorApprovalController } from './instructor-approval.controller';
import { InstructorApprovalService } from './instructor-approval.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [UsersController, InstructorApprovalController],
  providers: [UsersService, InstructorApprovalService],
  exports: [UsersService, InstructorApprovalService],
})
export class UsersModule {}
