import { Module } from '@nestjs/common';
import { InstructorPayoutsController } from './instructor-payouts.controller';
import { InstructorPayoutsService } from './instructor-payouts.service';

@Module({
  controllers: [InstructorPayoutsController],
  providers: [InstructorPayoutsService],
  exports: [InstructorPayoutsService],
})
export class InstructorPayoutsModule {}
