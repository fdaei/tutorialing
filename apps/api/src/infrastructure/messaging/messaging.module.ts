import { Global, Module } from '@nestjs/common';
import { KavenegarProvider } from './sms/kavenegar.provider';
import { SMS_PROVIDER } from './sms/sms-provider';

@Global()
@Module({
  providers: [KavenegarProvider, { provide: SMS_PROVIDER, useExisting: KavenegarProvider }],
  exports: [SMS_PROVIDER],
})
export class MessagingModule {}
