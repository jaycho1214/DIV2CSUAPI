import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      (context.switchToHttp().getRequest().route.path as string).includes(
        'auth',
      )
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET_KEY'),
        algorithms: ['HS512'],
      });
      if (!payload.verified) {
        return false;
      }
      request['user'] = payload;
      return true;
    } catch (e) {
      throw new UnauthorizedException();
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] =
      new String(request.headers['authorization']).split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
