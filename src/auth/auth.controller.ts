import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import * as _ from 'lodash';
import {
  JwtPayload,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  UpdatePasswordDto,
} from './auth.interface';
import { AuthService } from './auth.service';
import { Jwt } from './auth.decorator';
import { randomBytes } from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(private appService: AuthService) {}

  @Post('signIn')
  signIn(@Body() form: SignInDto) {
    return this.appService.signIn(form.sn, form.password);
  }

  @Post('signUp')
  signUp(@Body() form: SignUpDto) {
    const permissions = [];
    if (form.type === 'nco') {
      permissions.push('GiveMeritPoint', 'GiveDemeritPoint');
    }
    return this.appService.signUp(form, permissions);
  }

  @Post('updatePassword')
  updatePassword(
    @Jwt() { sub }: JwtPayload,
    @Body() { password, newPassword }: UpdatePasswordDto,
  ) {
    return this.appService.updatePassword({
      sn: sub,
      password,
      newPassword,
    });
  }

  @Post('resetPassword')
  async resetPassword(
    @Jwt() { sub, scope }: JwtPayload,
    @Body() { sn }: ResetPasswordDto,
  ) {
    if (
      !_.intersection(['Admin', 'UserAdmin', 'ResetPasswordUser'], scope).length
    ) {
      throw new HttpException(
        '비밀번호 초기화 권한이 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (sub === sn) {
      throw new HttpException(
        '본인 비밀번호는 초기화 할 수 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    const password = randomBytes(6).toString('hex');
    await this.appService.updatePassword({
      sn,
      newPassword: password,
      force: true,
    });
    return { password };
  }
}
