import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { PointsService } from './points.service';
import { Jwt } from 'src/auth/auth.decorator';
import { JwtPayload } from 'src/auth/auth.interface';
import { CreatePointDto, VerifyPointDto } from './points.interface';

(BigInt.prototype as any).toJSON = () => (this as any)?.toString();

@Controller('points')
export class PointsController {
  constructor(private appService: PointsService) {}

  @Get()
  async fetchPoint(
    @Jwt() { sub }: JwtPayload,
    @Query('id') id?: string,
    @Query('sn') sn?: string,
  ) {
    if (id == null) {
      if (sn == null) {
        return this.appService.fetchPointsHistoryCount(sub);
      }
      return this.appService.fetchPointsHistoryCount(sn);
    }
    return this.appService.fetchPoint(id);
  }

  @Get('list')
  async fetchPoints(
    @Jwt() { sub, type }: JwtPayload,
    @Query('sn') sn?: string,
    @Query('page') page?: number,
  ) {
    if (type === 'enlisted') {
      return this.appService.fetchPointsHistory(sub, page ?? 0);
    }
    if (sn) {
      return this.appService.fetchPointsHistory(sn, page ?? 0);
    }
    return this.appService.fetchPendingPoints(sub);
  }

  @Get('total')
  async fetchTotalPoint(
    @Jwt() { sub, type }: JwtPayload,
    @Query('sn') sn?: string,
  ) {
    if (type === 'enlisted') {
      return this.appService.fetchTotalPoint(sub);
    }
    return this.appService.fetchTotalPoint(sn);
  }

  @Post('verify')
  async verifyPoint(
    @Jwt() { sub, scope, type }: JwtPayload,
    @Body() { id, value, rejectReason }: VerifyPointDto,
  ) {
    const point = await this.appService.fetchPoint(id);
    if (point == null) {
      throw new HttpException(
        '본 상벌점이 존재하지 않습니다',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (point.giver_id !== sub) {
      throw new HttpException(
        '본인한테 요청된 상벌점만 승인/반려 할 수 있십니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (type === 'enlisted') {
      throw new HttpException(
        '용사는 상벌점을 승인/반려 할 수 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!value && rejectReason == null) {
      throw new HttpException('반려 사유를 입력해주세요', HttpStatus.FORBIDDEN);
    }
    if (value) {
      this.checkIfSoldierHasPermission(point.value, scope);
    }
    return this.appService.verifyPoint(id, value, rejectReason);
  }

  @Post()
  async createPoint(
    @Jwt() { sub, type, scope }: JwtPayload,
    @Body() body: CreatePointDto,
  ) {
    body.value = Number(Math.round(body.value ?? 0));
    if (body.value === 0) {
      throw new HttpException(
        '1점 이상이거나 -1점 미만이어야합니다',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (type === 'enlisted') {
      if (body.giverId == null) {
        throw new HttpException(
          '수령자를 입력해주세요',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (body.giverId === sub) {
        throw new HttpException(
          '스스로에게 수여할 수 없습니다',
          HttpStatus.BAD_REQUEST,
        );
      }
      return this.appService.createPoint({
        given_at: new Date(body.givenAt),
        receiver_id: sub,
        reason: body.reason,
        giver_id: body.giverId,
        value: body.value,
        verified_at: null,
      });
    }
    if (body.receiverId == null) {
      throw new HttpException('받는이를 입력해주세요', HttpStatus.BAD_REQUEST);
    }
    this.checkIfSoldierHasPermission(body.value, scope);
    return this.appService.createPoint({
      receiver_id: body.receiverId,
      reason: body.reason,
      giver_id: sub,
      given_at: new Date(body.givenAt),
      value: body.value,
      verified_at: new Date(),
    });
  }

  @Delete()
  async deletePoint(@Query('id') id: string, @Jwt() { type, sub }: JwtPayload) {
    if (type === 'nco') {
      throw new HttpException(
        '간부는 상벌점을 지울 수 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    const data = await this.appService.fetchPoint(id);
    if (data == null) {
      return;
    }
    if (data.receiver_id !== sub) {
      throw new HttpException(
        '본인 상벌점만 삭제 할 수 있습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (
      data.verified_at ||
      data.rejected_at ||
      data.rejected_reason ||
      data.used_id
    ) {
      throw new HttpException(
        '이미 수락, 반려, 사용한 상벌점은 지울 수 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.appService.deletePoint(data.id);
  }

  private checkIfSoldierHasPermission(value: number, scope: string[]) {
    if (scope.includes('Admin') || scope.includes('PointAdmin')) {
      return;
    }
    if (value > 0 && !scope.includes('GiveMeritPoint')) {
      throw new HttpException(
        '상점을 줄 권한이 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (value > 5 && !scope.includes('GiveLargeMeritPoint')) {
      throw new HttpException(
        '5점 이상 상점을 줄 권한이 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (value < 0 && !scope.includes('GiveDemeritPoint')) {
      throw new HttpException(
        '벌점을 줄 권한이 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
    if (value < -5 && !scope.includes('GiveLargeDemeritPoint')) {
      throw new HttpException(
        '5점 이상 벌점을 줄 권한이 없습니다',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
