import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DBModule } from 'src/db/db.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [DBModule, PermissionsModule],
  controllers: [AuthController],
  providers: [JwtService, AuthService],
})
export class AuthModule {}
