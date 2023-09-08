import { Module } from '@nestjs/common';
import { SoldiersController } from './soldiers.controller';
import { SoldiersService } from './soldiers.service';
import { DBModule } from 'src/db/db.module';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
  imports: [DBModule, PermissionsModule],
  controllers: [SoldiersController],
  providers: [SoldiersService],
})
export class SoldiersModule {}
