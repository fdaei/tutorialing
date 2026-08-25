import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY, PERMISSIONS_KEY } from '../constants/auth.constants';
import { AuthUser } from '../types/authenticated-user.type';
import { forbidden } from '../exceptions/domain.exception';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const perms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (roles.length && !roles.some((r) => req.user.roles.includes(r))) throw forbidden('ROLE_NOT_PERMITTED');
    if (perms.length && !perms.every((p) => req.user.permissions.includes(p)))
      throw forbidden('PERMISSION_NOT_GRANTED');
    return true;
  }
}
