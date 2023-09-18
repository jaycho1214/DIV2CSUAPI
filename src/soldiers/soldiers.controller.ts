import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  ParseBoolPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { SoldiersService } from './soldiers.service';
import { Jwt } from 'src/auth/auth.decorator';
import { JwtPayload } from 'src/auth/auth.interface';
import * as _ from 'lodash';
import { UpdateUserDto, VerifyUserDto } from './soldiers.interface';

@Controller('soldiers')
export class SoldiersController {
  constructor(private appService: SoldiersService) {}

  /**
   * 유저 검색
   * @param type 유저 유형, 간부인지 용사인지
   * @param scope 유저 권한 
   * @param {boolean} autoComplete True일 경우 자동완성을 위한 검색 (권한 무시) 
   * @param targetType 검색하는 유저의 유형 (간부, 용사)
   * @param query 검색어 (빈 검색어는 모든 유저를 리턴함)
   * @param page 페이지
   * @param unverifiedOnly 승인받지 않은 유저만 찾기
   * @param {boolean} count True일 경우 검색된 유저가 몇명인지 리턴
   * 
   * @throws Admin, UserAdmin, VerifyUser, ListUser 권한이 없이 승인받지 않은 유저를 검색할려 할때
   * @throws 자동완성을 위한 검색이 아닌데 Admin, UserAdmin, ListUser 권한 없이 검색할려 할때 
   * @returns 
   */
  @Get('search')
  async searchSoldier(
    @Jwt() { type, scope }: JwtPayload,
    @Query('autoComplete', new ParseBoolPipe({ optional: true }))
    autoComplete = false,
    @Query('type') targetType: string,
    @Query('query') query = '',
    @Query('page') page?: string | null,
    @Query('unverifiedOnly', new ParseBoolPipe({ optional: true }))
    unverifiedOnly = false,
    @Query('count', new ParseBoolPipe({ optional: true }))
    count = false,
  ) {
    if (autoComplete) {
      if (type === 'enlisted') {
        return this.appService.searchSoldiers({
          query,
          type: 'nco',
          permissions: [
            'GiveMeritPoint',
            'GiveLargeMeritPoint',
            'GiveDemeritPoint',
            'GiveLargeDemeritPoint',
            'PointAdmin',
            'Admin',
          ],
        });
      } else {
        return this.appService.searchSoldiers({ query, type: 'enlisted' });
      }
    }
    if (unverifiedOnly) {
      if (
        !_.intersection(['Admin', 'UserAdmin', 'VerifyUser', 'ListUser'], scope)
          .length
      ) {
        throw new HttpException('권한이 없습니다', HttpStatus.FORBIDDEN);
      }
      return this.appService.searchUnverifiedSoldiers();
    }
    if (!_.intersection(['Admin', 'UserAdmin', 'ListUser'], scope).length) {
      throw new HttpException('권한이 없습니다', HttpStatus.FORBIDDEN);
    }
    if (targetType === 'enlisted' || targetType === 'nco') {
      return this.appService.searchSoldiers({ query, type: targetType });
    }
    return this.appService.searchSoldiers({
      query,
      page: page ? parseInt(page || '1', 10) : null,
      includeCount: count,
    });
  }

  /**
   * 용사 정보를 가져옴
   * @param {string} sub 요청하는 용사의 군번
   * @param {?sn} sn 대상자의 군번, null일 경우 sub으로 대체됨 
   * @returns 용사 정보, 데이터가 없을 경우 빈 object를 리턴
   */
  @Get()
  async fetchSoldier(@Jwt() { sub }: JwtPayload, @Query('sn') sn?: string) {
    const target = sn || sub;
    const data = await this.appService.fetchSoldier(target);
    if (data == null) {
      return {};
    }
    return data;
  }

  /**
   * 회원가입 승인
   * @param {string[]} scope 요청자의 권한
   * @param form 대상자 군번 및 액션
   * @param form.sn 대상자 군번
   * @param form.value True일 경우, 승인 False일 경우 반려
   * @throws {HttpException} 회원가입 승인 권한이 없을 경우 오류
   * @returns {Promise}
   */
  @Post('verify')
  async verifySoldier(
    @Jwt() { scope }: JwtPayload,
    @Body() form: VerifyUserDto,
  ) {
    if (!_.intersection(['Admin', 'UserAdmin', 'VerifyUser'], scope).length) {
      throw new HttpException('권한이 없습니다', HttpStatus.FORBIDDEN);
    }
    return this.appService.verifySoldier(form.sn, form.value);
  }

  /**
   * 권한 수정/추가/삭제
   * @param {string} sub 요청자의 군번
   * @param {string[]} scope 요청자의 권한 
   * @param form
   * @param form.sn 대상자 군번
   * @param {string} form.permissions JSON Deserializable한 Permissions 예) '["Admin"]'
   * @throws 본인 권한을 수정할 경우 오류
   * @throws 관리자의 권한을 수정할 경우 오류
   * @throws 관리자 권한을 추가할려할 경우 오류
   * @throws 권한 변경 권한이 없을 경우 오류
   * @returns 
   */
  @Put()
  async updateSoldierPermissions(
    @Jwt() { sub, scope }: JwtPayload,
    @Body() form: UpdateUserDto,
  ) {
    const permissions = JSON.parse(form.permissions);
    if (form.sn === sub) {
      throw new HttpException(
        '본인 정보는 수정할 수 없습니다',
        HttpStatus.BAD_REQUEST,
      );
    }
    const targetUser = await this.appService.fetchSoldier(form.sn);
    if (targetUser.permissions.map(({ value }) => value).includes('Admin')) {
      throw new HttpException(
        '관리자는 수정할 수 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (
      !_.intersection(scope, ['Admin', 'UserAdmin', 'GiveUserPermission'])
        .length
    ) {
      throw new HttpException(
        '권한 수정 권한이 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (permissions.includes('Admin')) {
      throw new HttpException(
        '관리자 권한은 추가할 수 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.appService.setSoldierPermissions(form.sn, permissions);
  }

  /**
   * 유저 삭제
   * @param requestSn 요청자 군번
   * @param scope 요청자 권한
   * @param sn 대상자 군번
   * @param value 삭제 여부, True일 경우 삭제, False일 경우 복원
   * @throws 관리자를 삭제할려 할 경우 오류
   * @throws 유저 삭제 권한이 없을 경우 오류
   * @throws 본인을 삭제할려 할 경우 오류
   * @returns 
   */
  @Delete()
  async deleteUser(
    @Jwt() { sub: requestSn, scope }: JwtPayload,
    @Query('sn') sn?: string,
    @Query('value') value?: boolean,
  ) {
    if (sn == null) {
      throw new HttpException('sn(군번) 값이 없습니다', HttpStatus.BAD_REQUEST);
    }
    if (value == null) {
      throw new HttpException('value 값이 없습니다', HttpStatus.BAD_REQUEST);
    }
    if(requestSn === sn) {
      throw new HttpException('본인은 삭제할 수 없습니다', HttpStatus.BAD_REQUEST);
    }
    const targetUser = await this.appService.fetchSoldier(sn);
    if (targetUser.permissions.map(({ value }) => value).includes('Admin')) {
      throw new HttpException(
        '관리자는 삭제할 수 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!_.intersection(scope, ['Admin', 'UserAdmin', 'DeleteUser']).length) {
      throw new HttpException(
        '유저 삭제 권한이 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.appService.updateSoldier(sn, {
      deleted_at: value ? new Date() : null,
    });
  }
}
