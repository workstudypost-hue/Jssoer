import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * خدمة الصلاحيات المركزية.
 * كل الأدوار والصلاحيات تُقرأ من قاعدة البيانات (roles/permissions/role_permissions)
 * وليست مُثبَّتة بالكود — كما صُمم في مصفوفة RBAC عبر جلسة التصميم.
 */
@Injectable()
export class RbacService {
  constructor(private prisma: PrismaService) {}

  /**
   * يتحقق هل يملك المستخدم صلاحية (resource.action) عبر أيٍّ من أدواره.
   */
  async userHasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: {
        userId,
        role: {
          permissions: {
            some: {
              permission: { resource, action },
            },
          },
        },
      },
    });
    return count > 0;
  }

  /**
   * يُرجع كل أسماء أدوار المستخدم (تُستخدم لبناء الـ JWT payload
   * وتُدرَج أيضًا في activity_logs.actor_role كـ snapshot تاريخي).
   */
  async getUserRoleNames(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((ur) => ur.role.name);
  }
}
