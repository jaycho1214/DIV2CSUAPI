import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DBService } from './db.service';

@Global()
@Module({
  providers: [ConfigService, DBService],
  exports: [ConfigService, DBService],
})
export class DBModule {}
