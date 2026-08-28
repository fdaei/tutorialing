import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FilesService } from '../files/files.service';
@Injectable()
export class UsersService {
  constructor(private db: PrismaService, private files: FilesService) {}
  async me(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        avatarKey: true,
        birthDate: true,
        locale: true,
        timezone: true,
        profileComplete: true,
        status: true,
        roles: { select: { role: true, permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
    if (!user) return null;
    const permissions = [...new Set(user.roles.flatMap((role) => role.permissions.map((item) => item.permission.key)))];
    const avatarUrl = user.avatarKey ? await this.files.createDownloadUrl(user.avatarKey) : null;
    return { ...user, avatarUrl, roles: user.roles.map((role) => role.role), permissions };
  }
  update(id: string, d: { name: string; email?: string; locale: 'fa' | 'en'; timezone: string; birthDate?: string }) {
    const { birthDate, ...rest } = d;
    return this.db.user.update({
      where: { id },
      data: {
        ...rest,
        profileComplete: true,
        // Pinned to UTC midnight so the stored month/day is the date the student
        // entered. Parsing a bare `YYYY-MM-DD` is already UTC, but an explicit suffix
        // keeps a full timestamp from shifting the day in a negative-offset zone.
        ...(birthDate ? { birthDate: new Date(`${birthDate.slice(0, 10)}T00:00:00.000Z`) } : {}),
      },
    });
  }
  locale(id: string, locale: 'fa' | 'en') {
    return this.db.user.update({ where: { id }, data: { locale }, select: { locale: true } });
  }
  async setAvatar(id: string, fileId: string) {
    const file = await this.files.ownedSafeImage(id, fileId);
    await this.db.user.update({ where: { id }, data: { avatarKey: file.key } });
    return { avatarUrl: await this.files.createDownloadUrl(file.key) };
  }
  removeAvatar(id: string) {
    return this.db.user.update({ where: { id }, data: { avatarKey: null }, select: { id: true } });
  }
  favorites(id: string) {
    return this.db.favorite.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } });
  }
  async favorite(userId: string, teacherId: string) {
    await this.db.teacher.findFirstOrThrow({ where: { id: teacherId, status: 'APPROVED' } });
    return this.db.favorite.upsert({
      where: { userId_teacherId: { userId, teacherId } },
      create: { userId, teacherId },
      update: {},
    });
  }
  unfavorite(userId: string, teacherId: string) {
    return this.db.favorite.deleteMany({ where: { userId, teacherId } });
  }
}
