import { jsonArrayFrom } from 'kysely/helpers/mysql';
import { Injectable } from '@nestjs/common';
import { DBService } from 'src/db/db.service';
import { UpdateObject } from 'kysely';
import { DB } from 'kysely-codegen';
import { PermissionsService } from 'src/permissions/permissions.service';

@Injectable()
export class SoldiersService {
  constructor(
    private dbService: DBService,
    private permissionsService: PermissionsService,
  ) {}

  async fetchSoldier(sn: string) {
    return this.dbService
      .selectFrom('soldiers')
      .where('sn', '=', sn)
      .select((eb) => [
        'soldiers.sn',
        'soldiers.name',
        'soldiers.type',
        'soldiers.verified_at',
        'soldiers.deleted_at',
        jsonArrayFrom(
          eb
            .selectFrom('permissions')
            .select(['value'])
            .whereRef('permissions.soldiers_id', '=', 'soldiers.sn'),
        ).as('permissions'),
      ])
      .executeTakeFirst();
  }

  async fetchTotalSoldiersCount() {
    return this.dbService
      .selectFrom('soldiers')
      .where('rejected_at', 'is not', undefined)
      .where('verified_at', 'is not', undefined)
      .select((eb) => eb.fn.count('sn').as('count'))
      .executeTakeFirst();
  }

  async searchSoldiers({
    query,
    page,
    type,
    permissions = [],
    includeCount = false,
  }: {
    query: string;
    page?: number | null;
    type?: 'enlisted' | 'nco' | null;
    permissions?: string[];
    includeCount?: boolean;
  }) {
    const sql = this.dbService
      .selectFrom('soldiers')
      .where((eb) =>
        eb.and([
          eb.or([
            eb('sn', 'like', `%${query}%`),
            eb('name', 'like', `%${query}%`),
          ]),
          eb.or([
            eb('rejected_at', 'is not', undefined),
            eb('verified_at', 'is not', undefined),
          ]),
        ]),
      )
      .$if(type != null, (qb) => qb.where('type', '=', type))
      .$if(permissions.length > 0, (qb) =>
        qb.where((eb) =>
          eb.exists(
            eb
              .selectFrom('permissions')
              .whereRef('permissions.soldiers_id', '=', 'soldiers.sn')
              .having('value', 'in', permissions)
              .select('permissions.value'),
          ),
        ),
      )
      .$if(page != null, (qb) => qb.limit(10))
      .$if(page != null, (qb) => qb.offset(Math.max(1, page) * 10 - 10));

    if (includeCount) {
      return Promise.all([
        sql.select(['sn', 'name', 'type']).execute(),
        sql.select((eb) => eb.fn.count('sn').as('count')).executeTakeFirst(),
      ]);
    } else {
      return sql.select(['sn', 'name', 'type']).execute();
    }
  }

  async searchUnverifiedSoldiers() {
    return this.dbService
      .selectFrom('soldiers')
      .select(['sn', 'name', 'type'])
      .where('verified_at', 'is', undefined)
      .execute();
  }

  async verifySoldier(sn: string, value: boolean) {
    return this.dbService
      .updateTable('soldiers')
      .where('sn', '=', sn)
      .set(value ? { verified_at: new Date() } : { rejected_at: new Date() })
      .executeTakeFirstOrThrow();
  }

  async updateSoldier(
    sn: string,
    data: UpdateObject<DB, 'soldiers', 'soldiers'>,
  ) {
    return this.dbService
      .updateTable('soldiers')
      .where('sn', '=', sn)
      .set(data)
      .executeTakeFirstOrThrow();
  }

  async setSoldierPermissions(sn: string, permissions: string[]) {
    permissions.forEach((p) => {
      this.permissionsService.validatePermission(p);
    });
    await this.dbService
      .deleteFrom('permissions')
      .where('soldiers_id', '=', sn)
      .executeTakeFirstOrThrow();
    if (permissions.length === 0) {
      return;
    }
    return this.dbService
      .insertInto('permissions')
      .values(
        this.permissionsService
          .sortPermission(permissions)
          .map((p) => ({ soldiers_id: sn, value: p })),
      )
      .executeTakeFirstOrThrow();
  }
}
