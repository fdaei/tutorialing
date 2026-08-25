import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { authConfig } from '../../config/auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const cfg = authConfig();
        return { secret: cfg.accessSecret, signOptions: { expiresIn: cfg.accessTokenTtl } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SmsService],
  exports: [AuthService],
})
export class AuthModule {}
