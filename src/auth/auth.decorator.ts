import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { verify } from 'jsonwebtoken';

export const Jwt = createParamDecorator((_, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const token: string = request.headers['authorization'];
  const accessToken = token.split(' ').pop();
  const data = verify(accessToken, process.env.JWT_SECRET_KEY, {
    algorithms: ['HS512'],
  });
  return data;
});
