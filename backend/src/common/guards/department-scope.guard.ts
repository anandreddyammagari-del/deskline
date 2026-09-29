import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class DepartmentScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied: unauthenticated');
    }

    // Admins bypass department boundaries
    if (user.role === Role.ADMIN) {
      return true;
    }

    // Employees cannot access agent/staff department resources
    if (user.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Access denied: staff department scope required');
    }

    // Agents and Managers must belong to a department
    if (!user.departmentId) {
      throw new ForbiddenException('Access denied: user is not assigned to any department');
    }

    // If request specifies a departmentId in params or query, verify match
    const targetDeptId =
      request.params?.departmentId ||
      request.query?.departmentId ||
      request.body?.departmentId;

    if (targetDeptId && targetDeptId !== user.departmentId) {
      throw new ForbiddenException(
        'Access denied: cross-department staff access is prohibited',
      );
    }

    return true;
  }
}
