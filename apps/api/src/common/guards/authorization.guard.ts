import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY, PERMISSIONS_KEY } from '../constants/auth.constants';
import { AuthUser } from '../types/authenticated-user.type';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const perms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (roles.length && !roles.some(r => req.user.roles.includes(r))) throw new ForbiddenException('Role not permitted');
    if (perms.length && !perms.every(p => req.user.permissions.includes(p))) throw new ForbiddenException('Permission not granted');
    return true;
  }
}
