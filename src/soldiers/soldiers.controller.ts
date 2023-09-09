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

  @Get()
  async fetchSoldier(@Jwt() { sub }: JwtPayload, @Query('sn') sn?: string) {
    const target = sn || sub;
    const data = await this.appService.fetchSoldier(target);
    if (data == null) {
      return {};
    }
    return data;
  }

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

  @Delete()
  deleteUser(
    @Jwt() { scope }: JwtPayload,
    @Query('sn') sn?: string,
    @Query('value') value?: boolean,
  ) {
    if (sn == null) {
      throw new HttpException('sn(군번) 값이 없습니다', HttpStatus.BAD_REQUEST);
    }
    if (value == null) {
      throw new HttpException('value 값이 없습니다', HttpStatus.BAD_REQUEST);
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
