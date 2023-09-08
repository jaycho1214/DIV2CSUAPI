import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { DBService } from 'src/db/db.service';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [],
  controllers: [PointsController],
  providers: [ConfigService, DBService, PointsService],
})
export class PointsModule {}
