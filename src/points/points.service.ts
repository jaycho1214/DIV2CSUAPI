import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DBService } from 'src/db/db.service';
import { InsertObject, NoResultError } from 'kysely';
import { DB } from 'kysely-codegen';

@Injectable()
export class PointsService {
  constructor(private dbService: DBService) {}

  async fetchPoint(pointId: string) {
    return this.dbService
      .selectFrom('points')
      .where('id', '=', pointId)
      .leftJoin('soldiers as g', 'g.sn', 'points.giver_id')
      .leftJoin('soldiers as r', 'r.sn', 'points.receiver_id')
      .selectAll(['points'])
      .select(['r.name as receiver', 'g.name as giver'])
      .executeTakeFirst();
  }

  async fetchPointsHistory(sn: string, page = 0) {
    const { type } = await this.dbService
      .selectFrom('soldiers')
      .where('sn', '=', sn)
      .select('type')
      .executeTakeFirstOrThrow();
    return this.dbService
      .selectFrom('points')
      .where(type === 'enlisted' ? 'receiver_id' : 'giver_id', '=', sn)
      .orderBy('created_at desc')
      .select('id')
      .limit(20)
      .offset(Math.min(0, page) * 20)
      .execute();
  }

  async fetchPointsHistoryCount(sn: string) {
    const { type } = await this.dbService
      .selectFrom('soldiers')
      .where('sn', '=', sn)
      .select('type')
      .executeTakeFirstOrThrow();
    return this.dbService
      .selectFrom('points')
      .where(type === 'enlisted' ? 'receiver_id' : 'giver_id', '=', sn)
      .select((eb) => eb.fn.count('id').as('count'))
      .executeTakeFirst();
  }

  async fetchPendingPoints(sn: string) {
    return this.dbService
      .selectFrom('points')
      .where('giver_id', '=', sn)
      .where('verified_at', 'is', undefined)
      .selectAll()
      .execute();
  }

  async fetchTotalPoint(sn: string) {
    const [verifiedPointData, unverifiedPointData] = await Promise.all([
      this.dbService
        .selectFrom('points')
        .where('receiver_id', '=', sn)
        .where('verified_at', 'is not', undefined)
        .select((eb) => eb.fn.sum('value').as('verified_point'))
        .executeTakeFirst(),
      this.dbService
        .selectFrom('points')
        .where('receiver_id', '=', sn)
        .where('verified_at', 'is', undefined)
        .select((eb) => eb.fn.sum('value').as('unverified_point'))
        .executeTakeFirst(),
    ]);
    return {
      verifiedPoint: verifiedPointData.verified_point ?? 0,
      unverifiedPoint: unverifiedPointData.unverified_point ?? 0,
    };
  }

  async createPoint(data: InsertObject<DB, 'points'>) {
    try {
      if (data.receiver_id) {
        await this.dbService
          .selectFrom('soldiers')
          .select('name')
          .where('sn', '=', data.receiver_id as string)
          .executeTakeFirstOrThrow();
      }
      if (data.giver_id) {
        await this.dbService
          .selectFrom('soldiers')
          .select('name')
          .where('sn', '=', data.giver_id as string)
          .executeTakeFirstOrThrow();
      }
    } catch (e) {
      if (e instanceof NoResultError) {
        throw new HttpException(
          '선택하신 유저가 존재하지 않습니다',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

     // 상/벌점 내용과 대응값
     const meritData = [
      { id: 1, name: '상점 1', value: 5 },
      { id: 2, name: '상점 2', value: 3 },
    ];
    const demeritData = [
      { id: 1, name: '벌점 1', value: -5 },
      { id: 2, name: '벌점 2', value: -3 },
    ];
    
    // 상점인지 벌점인지 확인하고 값을 가져옴.
    let pointValue = 0;
    if (data.value) {
      const foundMerit = meritData.find(merit => merit.id === Number(data.value));
      const foundDemerit = demeritData.find(demerit => demerit.id === Number(data.value));
      if (foundMerit) {
        pointValue = foundMerit.value;
      } else if (foundDemerit) {
        pointValue = foundDemerit.value;
      }
    }
    data.value = pointValue;

    return this.dbService
      .insertInto('points')
      .values(data)
      .executeTakeFirstOrThrow();
  }

  async deletePoint(id: string) {
    return this.dbService
      .deleteFrom('points')
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async verifyPoint(id: string, value: boolean, reason?: string) {
    return this.dbService
      .updateTable('points')
      .where('id', '=', id)
      .set({
        verified_at: value ? new Date() : null,
        rejected_at: !value ? new Date() : null,
        rejected_reason: reason,
      })
      .execute();
  }
}
