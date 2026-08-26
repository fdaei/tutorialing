import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthorizationManagementService } from '../auth';
import { TokenRevocationService } from '../auth/token-revocation.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly authorization: AuthorizationManagementService,
    private readonly revocation: TokenRevocationService,
  ) {}

  async list(page = 1, search = '', status = '') {
    const take = 30;
    const where: Prisma.UserWhereInput = {
      ...(search && { OR: [
        { name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ] }),
      ...(['ACTIVE', 'SUSPENDED', 'DELETED'].includes(status) && { status: status as UserStatus }),
    };
    const [data, total] = await this.db.$transaction([
      this.db.user.findMany({ where, skip: (Math.max(1, page) - 1) * take, take, include: { roles: true }, orderBy: { createdAt: 'desc' } }),
      this.db.user.count({ where }),
    ]);
    return { data, total, page: Math.max(1, page), totalPages: Math.ceil(total / take) };
  }

  async detail(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        teacher: { select: { slug: true, nameFa: true, nameEn: true, status: true, rating: true, reviewsCount: true } },
        bookings: { take: 5, orderBy: { createdAt: 'desc' }, select: { startsAt: true, endsAt: true, status: true, type: true, price: true, teacher: { select: { nameFa: true, nameEn: true } } } },
        attempts: { take: 5, orderBy: { createdAt: 'desc' }, select: { status: true, overallBand: true, startedAt: true, submittedAt: true, test: { select: { titleFa: true, titleEn: true } } } },
        payments: { take: 5, orderBy: { createdAt: 'desc' }, select: { purpose: true, amount: true, status: true, createdAt: true } },
        tickets: { take: 5, orderBy: { updatedAt: 'desc' }, select: { subject: true, status: true, priority: true, updatedAt: true } },
        learningPlans: { take: 5, orderBy: { updatedAt: 'desc' }, select: { title: true, targetBand: true, status: true, examDate: true, teacher: { select: { nameFa: true, nameEn: true } } } },
        _count: { select: { bookings: true, attempts: true, payments: true, tickets: true, learningPlans: true, enrollments: true } },
      },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return user;
  }

  async create(actorId: string, data: { phone: string; name: string; email?: string; locale?: string; roles?: Role[] }) {
    const roles: Role[] = data.roles?.length ? data.roles : ['STUDENT'];
    for (const role of roles) await this.authorization.assertMayGrantRole(actorId, role);
    const user = await this.db.user.create({ data: {
      phone: data.phone, name: data.name.trim(), email: data.email?.trim() || undefined,
      locale: data.locale ?? 'fa', profileComplete: true, roles: { create: roles.map((role) => ({ role })) },
    }, include: { roles: true } });
    if (roles.includes('ADMIN')) await this.authorization.grantAdminPermissions(user.id);
    await this.db.auditLog.create({ data: { actorId, action: 'user.created', entity: 'User', entityId: user.id, after: { phone: user.phone, roles } } });
    return user;
  }

  async updateStatus(actorId: string, userId: string, status: UserStatus) {
    const before = await this.db.user.findUnique({ where: { id: userId } });
    if (!before) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (before.id === actorId && status !== 'ACTIVE') throw new BadRequestException({ code: 'SELF_ACCOUNT_DISABLE' });
    const user = await this.db.user.update({ where: { id: userId }, data: { status } });
    if (status !== 'ACTIVE') await this.revocation.revokeUser(userId);
    await this.db.auditLog.create({ data: { actorId, action: 'user.status.changed', entity: 'User', entityId: userId, before: { status: before.status }, after: { status } } });
    return user;
  }
}
