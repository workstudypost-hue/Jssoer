import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * استخدام:
 * @RequirePermissions({ resource: 'custom_requests', action: 'price' })
 * يُقرأ لاحقًا من PermissionsGuard للتحقق قبل تنفيذ أي Endpoint حساس.
 */
export interface RequiredPermission {
  resource: string;
  action: string;
}

export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
