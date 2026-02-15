import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { UserRole } from '../../model/enum/role.enum';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { UserInfo } from './auth.guard';
import { RbacService } from '../../service/rbac/rbac.service';

@Injectable()
export class RoleGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private readonly rbacService: RbacService,
    ) { }

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredRoles) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            throw new UnauthorizedException('User not authenticated');
        }

        const userInfo: UserInfo = user;

        // Check if ANY of the user's roles satisfy ANY of the required roles via hierarchy
        for (const reqRole of requiredRoles) {
            for (const userRole of userInfo.roles) {
                if (this.rbacService.isAuthorized({ currentRole: userRole, requiredRole: reqRole })) {
                    return true;
                }
            }
        }

        return false;
    }
}
