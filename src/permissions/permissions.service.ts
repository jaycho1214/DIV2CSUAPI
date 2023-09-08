import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DBService } from 'src/db/db.service';

@Injectable()
export class PermissionsService {
  constructor(private dbService: DBService) {}

  sortPermission(permissions: string[]) {
    if (permissions.includes('Admin')) {
      permissions = ['Admin'];
    }
    if (permissions.includes('UserAdmin')) {
      permissions = permissions
        .filter((p) => !p.includes('User'))
        .concat('UserAdmin');
    }
    if (permissions.includes('PointAdmin')) {
      permissions = permissions
        .filter((p) => !p.includes('Point'))
        .concat('PointAdmin');
    }
    return permissions;
  }

  validatePermission(permission: string) {
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
