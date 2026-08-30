import { IsUUID } from 'class-validator';

export class AssignInstructorDto {
  @IsUUID()
  instructorId: string;
}
