import { applyDecorators } from '@nestjs/common';
import { Permissions, Roles } from '../core/decorators';

/**
 * `@Roles()` + `@Permissions()` — routes that need both a coarse role check
 * and a fine-grained permission check pair them together; compose once
 * instead of repeating both on every such route/controller.
 */
export const Authorize = (roles: string[], permissions: string[] = []) =>
  applyDecorators(Roles(...roles), Permissions(...permissions));
