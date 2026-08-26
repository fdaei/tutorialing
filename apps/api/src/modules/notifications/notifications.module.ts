import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AdminNotificationsController } from './admin-notifications.controller';

@Module({ controllers: [NotificationsController, AdminNotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
