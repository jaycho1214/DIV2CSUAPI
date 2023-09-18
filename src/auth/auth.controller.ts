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

  /**
   * 로그인 API
   * @param {{sn: string, password: string}} form 로그인을 위한 군번과 비밀번호
   * @returns {{accessToken: string}} 암호화된 Access Token을 리턴함
   */
  @Post('signIn')
  signIn(@Body() form: SignInDto) {
    return this.appService.signIn(form.sn, form.password);
  }

  /**
   * 회원가입 API
   * @param form 회원가입을 위한 정보
   * @param form.sn 군번
   * @param form.name 이름
   * @param {'enlisted' | 'nco'} form.type 용사및 간부 여부
   * @param form.password 비밀번호
   * @returns {Promise<{accessToken: string}>} 암호화된 Access Token을 리턴함
   */
  @Post('signUp')
  signUp(@Body() form: SignUpDto) {
    const permissions = [];
    if (form.type === 'nco') {
      permissions.push('GiveMeritPoint', 'GiveDemeritPoint');
    }
    return this.appService.signUp(form, permissions);
  }

  /**
   * 비밀번호 변경 API
   * @param {{sub: string}} sub 변경 대상 군번
   * @param {string} password 기존 비밀번호
   * @param {string} newPassword 새 비밀번호
   * @returns {Promise}
   */
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

  /**
   * 비밀번호 초기화 API
   * @param {string} sub 요청자의 군번
   * @param {string[]} scope 요청자의 권한
   * @param {string} sn 비밀번호 초기화 대상자의 군번
   * @throws 요청자에게 Admin, UserAdmin, ResetPasswordUser가 없을 경우 오류
   * @throws 요청자와 대상자의 군번이 같은 경우 오류 
   * @returns {{password: string}} 새 비밀번호
   */
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
    // 랜덤 비밀번호 생성
    const password = randomBytes(6).toString('hex');
    await this.appService.updatePassword({
      sn,
      newPassword: password,
      force: true,
    });
    return { password };
  }
}
