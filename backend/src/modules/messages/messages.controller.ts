import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private service: MessagesService) {}

  @Post()
  send(@Body() dto: SendMessageDto, @Req() req: any) {
    const senderIsStaff = Boolean(req.user.isStaff);
    return this.service.send(dto, req.user.sub, senderIsStaff);
  }
}
