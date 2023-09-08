import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { SoldiersModule } from './soldiers/soldiers.module';
import { PointsModule } from './points/points.module';

@Module({
  imports: [ConfigModule.forRoot(), AuthModule, SoldiersModule, PointsModule],
  controllers: [],
  providers: [JwtService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
