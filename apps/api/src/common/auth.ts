import { CanActivate,ExecutionContext,ForbiddenException,Injectable,SetMetadata,UnauthorizedException,createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
export const PUBLIC_KEY='public'; export const Public=()=>SetMetadata(PUBLIC_KEY,true);
export const ROLES_KEY='roles';export const Roles=(...roles:string[])=>SetMetadata(ROLES_KEY,roles);
export const PERMISSIONS_KEY='permissions';export const Permissions=(...permissions:string[])=>SetMetadata(PERMISSIONS_KEY,permissions);
export type AuthUser={id:string;roles:string[];permissions:string[];sessionId:string};
export const CurrentUser=createParamDecorator((_data,ctx)=>ctx.switchToHttp().getRequest<Request&{user:AuthUser}>().user);
@Injectable() export class AccessGuard implements CanActivate{constructor(private reflector:Reflector,private jwt:JwtService){}async canActivate(ctx:ExecutionContext){if(this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY,[ctx.getHandler(),ctx.getClass()]))return true;const req=ctx.switchToHttp().getRequest<Request&{user:AuthUser}>();const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)throw new UnauthorizedException('Authentication required');try{req.user=await this.jwt.verifyAsync<AuthUser>(token);return true}catch{throw new UnauthorizedException('Invalid or expired access token')}}}
@Injectable() export class AuthorizationGuard implements CanActivate{constructor(private reflector:Reflector){}canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest<Request&{user:AuthUser}>();const roles=this.reflector.getAllAndOverride<string[]>(ROLES_KEY,[ctx.getHandler(),ctx.getClass()])??[];const perms=this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY,[ctx.getHandler(),ctx.getClass()])??[];if(roles.length&&!roles.some(r=>req.user.roles.includes(r)))throw new ForbiddenException('Role not permitted');if(perms.length&&!perms.every(p=>req.user.permissions.includes(p)))throw new ForbiddenException('Permission not granted');return true}}
