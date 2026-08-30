import { forwardRef, Module } from '@nestjs/common';
import { CustomRequestsController } from './custom-requests.controller';
import { CustomRequestsService } from './custom-requests.service';
import { RequestTransitionService } from './state-machine/request-transition.service';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [forwardRef(() => PaymentsModule), NotificationsModule, StorageModule],
  controllers: [CustomRequestsController],
  providers: [CustomRequestsService, RequestTransitionService],
  exports: [CustomRequestsService],
})
export class CustomRequestsModule {}
