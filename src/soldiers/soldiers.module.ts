import { Module } from '@nestjs/common';
import { SoldiersController } from './soldiers.controller';
import { SoldiersService } from './soldiers.service';
import { DBService } from 'src/db.service';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [],
  controllers: [SoldiersController],
  providers: [ConfigService, DBService, SoldiersService],
})
export class SoldiersModule {}
