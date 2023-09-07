import { IsIn, IsNotEmpty, Matches } from 'class-validator';

export class SignInDto {
  @IsNotEmpty()
  @Matches(/^[0-9]{2}-[0-9]{5,8}$/)
  sn: string;

  @IsNotEmpty()
  password: string;
}

export class SignUpDto extends SignInDto {
  @IsNotEmpty()
  @Matches(/^[0-9]{2}-[0-9]{5,8}$/)
  sn: string;

  @IsNotEmpty()
  name: string;

  @IsIn(['enlisted', 'nco'])
  type: 'enlisted' | 'nco';

  @IsNotEmpty()
  password: string;
}

export class JwtPayload {
  sub: string;
  type: 'enlisted' | 'nco';
  scope: string[];
  verified: boolean;
}

export class UpdatePasswordDto {
  @IsNotEmpty()
  password: string;

  @IsNotEmpty()
  newPassword: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  sn: string;
}
