import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../../modules/rbac/rbac.service';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Endpoint بدون @RequirePermissions يُعتبر متاحًا لأي مستخدم مُصادَق عليه فقط
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // يُحقن من JwtAuthGuard الذي يُنفَّذ قبل هذا الـ Guard

    if (!user) {
      throw new ForbiddenException('المستخدم غير مصادَق عليه');
    }

    // يجب أن يملك المستخدم كل الصلاحيات المطلوبة (AND) لهذا الـ Endpoint
    for (const perm of requiredPermissions) {
      const hasPermission = await this.rbacService.userHasPermission(
        user.sub,
        perm.resource,
        perm.action,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          `الصلاحية المطلوبة غير متوفرة: ${perm.resource}.${perm.action}`,
        );
      }
    }

    return true;
  }
}
