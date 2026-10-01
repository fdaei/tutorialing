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
    return this.db.notification.findMany({ where: { userId }, include: { deliveries: true }, orderBy: { createdAt: 'desc' }, take: 100 }).then((items) =>
      items.map((item) => ({
        ...item,
        // Keep the bilingual fields for existing clients while exposing the
        // normalized notification contract used by the web app.
        title: item.titleFa,
        message: item.bodyFa,
        link: item.data && typeof item.data === 'object' && !Array.isArray(item.data) && typeof item.data.link === 'string' ? item.data.link : null,
      })),
    );
  }
  read(userId: string, id: string) {
    return this.db.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  }
  readAll(userId: string) {
    return this.db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
