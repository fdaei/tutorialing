import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY, PERMISSIONS_KEY } from '../constants/auth.constants';
import { AuthUser } from '../types/authenticated-user.type';
import { forbidden } from '../exceptions/domain.exception';
import { assertDomain } from '../utils';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const perms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    assertDomain(!roles.length || roles.some((role) => req.user.roles.includes(role)), () =>
      forbidden('ROLE_NOT_PERMITTED'),
    );
    assertDomain(!perms.length || perms.every((permission) => req.user.permissions.includes(permission)), () =>
      forbidden('PERMISSION_NOT_GRANTED'),
    );
    return true;
  }
}
