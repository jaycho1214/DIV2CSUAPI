import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DBService } from 'src/db/db.service';

@Injectable()
export class PermissionsService {
  constructor(private dbService: DBService) {}

  /**
   * 불필요한 권한 정리하기
   * @example Admin 권한이 있을경우 나머지 불필요 권한 제거
   * // returns ['Admin']
   * sortPermission(['Admin', 'UserAdmin', 'PointAdmin'])
   * @example UserAdmin 권한이 있을경우 하위 권한 제거
   * // returns ['UserAdmin']
   * sortPermission(['UserAdmin', 'ResetPasswordUser'])
   * @param {string[]} permissions 정리할려는 권한들
   * @returns 
   */
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

  /**
   * 유효한 권한인지 확인
   * @param {string} permission 확인할려는 권한
   * @throws {HttpException} 잘못된 권한일 경우 오류
   */
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
        'ViewPoint',
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
