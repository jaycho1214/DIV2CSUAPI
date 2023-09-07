import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DBService } from 'src/db.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AuthController],
  providers: [DBService, JwtService, AuthService],
})
export class AuthModule {}
