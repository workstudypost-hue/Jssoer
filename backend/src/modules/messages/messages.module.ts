import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { SecurityReviewModule } from '../security-review/security-review.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [SecurityReviewModule, AiGatewayModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
