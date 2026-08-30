import { IsEmail, IsUUID } from 'class-validator';

export class CreateStaffInvitationDto {
  @IsEmail()
  email: string;

  @IsUUID()
  roleId: string;
}
