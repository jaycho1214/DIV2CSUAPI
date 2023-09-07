import { IsBoolean, IsJSON, IsNotEmpty, Matches } from 'class-validator';

export class VerifyUserDto {
  @IsBoolean()
  value: boolean;

  @IsNotEmpty()
  sn: string;
}

export class UpdateUserDto {
  @IsNotEmpty()
  @Matches(/^[0-9]{2}-[0-9]{5,8}$/)
  sn: string;

  @IsJSON()
  permissions?: string[];
}
