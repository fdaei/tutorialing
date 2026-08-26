import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { authConfig } from '../../config/auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';
import { AccessGuard } from './access-token.guard';
import { TokenRevocationService } from './token-revocation.service';
import { AdminAuthorizationController } from './authorization/admin-authorization.controller';
import { AuthorizationManagementService } from './authorization/authorization-management.service';
import { RoleManagementPolicy } from './authorization/role-management.policy';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const cfg = authConfig();
        return { secret: cfg.accessSecret, signOptions: { expiresIn: cfg.accessTokenTtl } };
      },
    }),
  ],
  controllers: [AuthController, AdminAuthorizationController],
  providers: [AuthService, SmsService, AccessGuard, TokenRevocationService, AuthorizationManagementService, RoleManagementPolicy],
  exports: [AuthService, AccessGuard, TokenRevocationService, AuthorizationManagementService],
})
export class AuthModule {}
