import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: PrismaService) {}
  deliveries() {
    return this.db.notificationDelivery.findMany({
      include: { notification: { select: { userId: true, type: true, titleFa: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }
  list(userId: string) {
    return this.db.notification.findMany({ where: { userId }, include: { deliveries: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  read(userId: string, id: string) {
    return this.db.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  }
}
