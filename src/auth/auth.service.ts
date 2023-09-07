import { pbkdf2Sync, randomBytes } from 'crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DBService } from 'src/db.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InsertObject, NoResultError } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/mysql';
import { DB } from 'kysely-codegen';
import { DatabaseError } from '@planetscale/database';

@Injectable()
export class AuthService {
  constructor(
    private dbService: DBService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signIn(sn: string, password: string) {
    try {
      const data = await this.dbService
        .selectFrom('soldiers')
        .where('sn', '=', sn)
        .select((eb) => [
          'name',
          'type',
          'verified_at',
          'rejected_at',
          'password',
          jsonArrayFrom(
            eb
              .selectFrom('permissions')
              .select(['value', 'verified_at'])
              .whereRef('permissions.soldiers_id', '=', 'soldiers.sn'),
          ).as('permissions'),
        ])
        .executeTakeFirstOrThrow();

      const salt = data.password.slice(0, 32);
      const hashedPassword = data.password.slice(32);
      const hashed = pbkdf2Sync(password, salt, 104906, 64, 'sha256').toString(
        'base64',
      );
      if (hashedPassword !== hashed) {
        throw new HttpException(
          '잘못된 비밀번호 입니다',
          HttpStatus.UNAUTHORIZED,
        );
      }
      const accessToken = this.jwtService.sign(
        {
          name: data.name,
          sub: sn,
          scope: (data.permissions ?? []).map(({ value }) => value),
          verified: data.verified_at ? true : data.rejected_at ? false : null,
          type: data.type,
        },
        {
          secret: this.configService.getOrThrow('JWT_SECRET_KEY'),
          algorithm: 'HS512',
          expiresIn: '1h',
        },
      );
      return { accessToken };
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      if (e instanceof NoResultError) {
        throw new HttpException(
          '존재하지 않는 사용자입니다',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new HttpException(
        '데이터를 불러오는 중 문제가 생겼습니다',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async signUp(form: InsertObject<DB, 'soldiers'>, permissions: string[] = []) {
    const salt = randomBytes(24).toString('base64');
    const hashed = pbkdf2Sync(
      form.password as string,
      salt,
      104906,
      64,
      'sha256',
    ).toString('base64');
    try {
      await this.dbService
        .insertInto('soldiers')
        .values({
          name: form.name,
          sn: form.sn,
          type: form.type,
          password: salt + hashed,
        })
        .executeTakeFirstOrThrow();
    } catch (e) {
      if (e instanceof DatabaseError) {
        if (e.body.message.includes('AlreadyExists')) {
          throw new HttpException(
            '이미 존재하는 사용자입니다',
            HttpStatus.CONFLICT,
          );
        }
      }
      throw e;
    }
    if (permissions.length > 0) {
      permissions.forEach((permission) => {
        this.validatePermission(permission);
      });
      await this.dbService
        .insertInto('permissions')
        .values(permissions.map((p) => ({ soldiers_id: form.sn, value: p })))
        .executeTakeFirst();
    }
    const accessToken = this.jwtService.sign(
      {
        name: form.name,
        sub: form.sn,
        scope: [],
        verified: null,
        type: form.type,
      },
      {
        secret: this.configService.getOrThrow('JWT_SECRET_KEY'),
        algorithm: 'HS512',
        expiresIn: '1h',
      },
    );
    return { accessToken };
  }

  async updatePassword({
    sn,
    password,
    newPassword,
    force,
  }: {
    sn: string;
    password?: string;
    newPassword: string;
    force?: boolean;
  }) {
    const data = await this.dbService
      .selectFrom('soldiers')
      .where('sn', '=', sn)
      .select('password')
      .executeTakeFirstOrThrow();

    if (force !== true) {
      const oldSalt = data.password.slice(0, 32);
      const oldHashedPassword = data.password.slice(32);
      const oldHashed = pbkdf2Sync(
        password,
        oldSalt,
        104906,
        64,
        'sha256',
      ).toString('base64');
      if (oldHashedPassword !== oldHashed) {
        throw new HttpException(
          '잘못된 비밀번호 입니다',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    const salt = randomBytes(24).toString('base64');
    const hashed = pbkdf2Sync(
      newPassword as string,
      salt,
      104906,
      64,
      'sha256',
    ).toString('base64');

    await this.dbService
      .updateTable('soldiers')
      .where('sn', '=', sn)
      .set({ password: salt + hashed })
      .executeTakeFirstOrThrow();
  }

  private validatePermission(permission: string) {
    if (
      ![
        'Admin',
        'UserAdmin',
        'ListUser',
        'DeleteUser',
        'VerifyUser',
        'GivePermissionUser',
        'ResetPasswordUser',
        'PointAdmin',
        'GiveMeritPoint',
        'GiveLargeMeritPoint',
        'GiveDemeritPoint',
        'GiveLargeDemeritPoint',
      ].includes(permission)
    ) {
      throw new HttpException('알 수 없는 권한입니다', HttpStatus.BAD_REQUEST);
    }
  }
}
