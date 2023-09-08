import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely } from 'kysely';
import { DB } from 'kysely-codegen';
import { PlanetScaleDialect } from 'kysely-planetscale';

@Injectable()
export class DBService extends Kysely<DB> {
  constructor(private configService: ConfigService) {
    super({
      dialect: new PlanetScaleDialect({
        host: configService.getOrThrow('DB_HOST'),
        username: configService.getOrThrow('DB_USERNAME'),
        password: configService.getOrThrow('DB_PASSWORD'),
      }),
    });
  }
}
