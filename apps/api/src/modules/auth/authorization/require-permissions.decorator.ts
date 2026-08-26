import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY, PermissionKey } from './permission-registry';

export const RequirePermissions = (...permissions: PermissionKey[]) => SetMetadata(PERMISSIONS_KEY, permissions);
