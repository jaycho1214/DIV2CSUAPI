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
import * as _ from 'lodash';
import { PointsService } from './points.service';
import { Jwt } from 'src/auth/auth.decorator';
import { JwtPayload } from 'src/auth/auth.interface';
import { CreatePointDto, VerifyPointDto } from './points.interface';

(BigInt.prototype as any).toJSON = () => (this as any)?.toString();

@Controller('points')
export class PointsController {
  constructor(private appService: PointsService) {}

  /**
   * 상벌점 정보 받아오기
   * @param {string} sub 요청자의 군번
   * @param {?string} id 상벌점 UUID
   * @param {?string} sn 대상자의 군번
   * @returns id또는 sn이 null일경우 받은 상벌점 이력의 갯수를 리턴, 그 외는 상벌점 정보를 리턴
   */
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

  /**
   * 상벌점 리스트(승인 대기 포함)을 가져옴
   * @param sub 요청자의 군번
   * @param type 요청자의 유형 (간부, 용사)
   * @param scope 요청자의 권한들 
   * @param sn 대상 군번
   * @param page 페이지
   * 
   * @throws 본인이 아닌 다른 사람의 상벌점 리스트를 권한 없이 볼때
   * @returns 요청자가 용사일 경우 항상 자기것의 리스트만 리턴, 
   * 간부일 경우, sn값이 있을 경우 자기가 부여한 상벌점, 
   * 없을 경우 승인 대기중인 상벌점을 리턴 
   */
  @Get('list')
  async fetchPoints(
    @Jwt() { sub, type, scope }: JwtPayload,
    @Query('sn') sn?: string,
    @Query('page') page?: number,
  ) {
    if (
      sn != null &&
      sn !== sub &&
      !_.intersection(['PointAdmin', 'Admin', 'ViewPoint'], scope).length
    ) {
      throw new HttpException('접근 권한이 없습니다', HttpStatus.FORBIDDEN);
    }
    if (type === 'enlisted') {
      return this.appService.fetchPointsHistory(sub, page ?? 0);
    }
    if (sn) {
      return this.appService.fetchPointsHistory(sn, page ?? 0);
    }
    return this.appService.fetchPendingPoints(sub);
  }

  /**
   * 지금까지 받은 상벌점(승인, 미승인)의 총합을 리턴
   * @param sub 요청자의 군번
   * @param type 요청자의 유형 (간부, 용사) 
   * @param sn 대상자의 군번
   * @returns 요청자가 용사일경우 본인 상벌점의 총합만 리턴
   */
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

  /**
   * 상벌점 승인/반려
   * @param sub 요청자의 군번
   * @param scope 요청자의 권한들
   * @param type 요청자의 유형 (간부, 용사) 
   * @param id 승인할려는 상벌점의 UUID
   * @param value True일 경우 승인, False일 경우 반려
   * @param {?string} rejectReason 반려 이유(False일 경우 반려 이유를 필히 적어야함)
   * 
   * @throws 상벌점이 존재하지 않을때 오류
   * @throws 다른 사람에게 요청된 상벌점을 본인이 승인/반려 하려 할때
   * @throws 용사가 상벌점을 승인/반려 하려 할때
   * @throws 반려 사유 없이 반려할때
   * @throws 권한 없이 상벌점을 부여(5점 이하 또는 5점 초과)할때
   * @returns 
   */
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

  /**
   * 상벌점 요청/부여
   * @param sub 요청자의 군번
   * @param type 요청자의 유형 (간부, 용사)
   * @param scope 요청자의 권한
   * @param body 
   * @param body.giverId 수여자 군번
   * @param body.receiverId 수령자 군번
   * @param value 상벌점 점수
   * @param reason 상벌점 부여 이유
   * @param givenAt 상벌점 부여 시간
   * 
   * @throws 상벌점 점수가 0점일때 오류
   * @throws 요청자가 간부인데 수령자가 없거나, 용사인데 수여자가 없으면 오류
   * @throws 요청자가 용사인데 수여자와 부여자가 같을때 오류
   * @throws 권한이 없을때 오류
   * @returns 
   */
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

  /**
   * 상벌점 삭제
   * @param id 삭제할려는 상벌점 UUID
   * @param type 요청자의 유형 (간부, 용사)
   * @param sub 요청자의 군번
   * 
   * @throws 요청자가 간부일 경우
   * @throws 본인이 아닌 다른 사람의 상벌점을 삭제할려 할 경우
   * @throws 이미 수락, 반려된 상점을 삭제할려 할 경우
   * @returns 
   */
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

  /**
   * 유저가 상벌점 부여 권한이 있는지 확인 
   * @param value 부여할 상벌점
   * @param scope 소유한 권한들
   * @throws 권한이 없을 경우 오류
   * @returns 
   */
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
