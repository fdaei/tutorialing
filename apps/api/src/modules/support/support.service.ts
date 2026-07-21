import { Injectable } from '@nestjs/common';
import { Prisma, Role, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { badRequest, forbidden, notFound } from '../../common/errors';
import { config } from '../../config';

const STAFF_ROLES: Role[] = ['ADMIN', 'STAFF', 'SUPPORT'];
const isStaff = (roles: string[]) => roles.some((role) => STAFF_ROLES.includes(role as Role));
const authorRole = (roles: string[]): Role => (['ADMIN', 'SUPPORT', 'STAFF', 'FINANCE', 'EXAMINER', 'TEACHER', 'STUDENT'] as Role[]).find((role) => roles.includes(role)) ?? 'STUDENT';

@Injectable()
export class SupportService {
  constructor(private db: PrismaService) {}

  async create(userId: string, roles: string[], data: { subject: string; category: string; priority: string; body: string; attachmentId?: string }) {
    const now = new Date();
    const slaHours = data.priority === 'urgent' ? 2 : data.priority === 'high' ? 8 : data.priority === 'normal' ? 24 : 48;
    return this.db.ticket.create({
      data: {
        userId, subject: data.subject.trim(), category: data.category, priority: data.priority,
        slaDueAt: new Date(now.getTime() + slaHours * 3_600_000), lastReplyAt: now,
        replies: { create: { authorId: userId, authorRole: authorRole(roles), direction: 'INBOUND', messageType: 'USER_MESSAGE', body: data.body.trim(), attachmentId: data.attachmentId, internal: false } },
      },
      include: { replies: { include: { author: { select: { name: true, phone: true } } } }, user: { select: { name: true, phone: true, email: true } } },
    });
  }

  async list(userId: string, roles: string[], query: { scope?: string; status?: string; priority?: string; userId?: string; assignedToId?: string; search?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    const staff = isStaff(roles);
    const page = Math.max(1, query.page ?? 1), pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.TicketWhereInput = staff ? {} : { userId };
    if (staff && query.scope === 'mine') where.assignedToId = userId;
    if (staff && query.scope === 'unassigned') where.assignedToId = null;
    if (staff && query.userId) where.userId = query.userId;
    if (staff && query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.status && Object.values(TicketStatus).includes(query.status as TicketStatus)) where.status = query.status as TicketStatus;
    if (query.priority) where.priority = query.priority;
    if (query.from || query.to) where.createdAt = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) };
    if (query.search?.trim()) where.OR = [
      { subject: { contains: query.search.trim(), mode: 'insensitive' } },
      { replies: { some: { body: { contains: query.search.trim(), mode: 'insensitive' }, ...(staff ? {} : { internal: false }) } } },
      ...(staff ? [{ user: { OR: [{ name: { contains: query.search.trim(), mode: 'insensitive' as const } }, { phone: { contains: query.search.trim() } }, { email: { contains: query.search.trim(), mode: 'insensitive' as const } }] } }] : []),
    ];
    const [items, total] = await this.db.$transaction([
      this.db.ticket.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          assignedTo: { select: { id: true, name: true, phone: true, email: true } },
          replies: { where: staff ? {} : { internal: false }, orderBy: { createdAt: 'desc' }, take: 1, include: { author: { select: { name: true } } } },
          _count: { select: { replies: true } },
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.db.ticket.count({ where }),
    ]);
    return { items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } };
  }

  async detail(userId: string, roles: string[], ticketId: string) {
    const staff = isStaff(roles);
    const ticket = await this.db.ticket.findFirst({
      where: { id: ticketId, ...(staff ? {} : { userId }) },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        assignedTo: { select: { id: true, name: true, phone: true, email: true } },
        replies: { where: staff ? {} : { internal: false }, orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, phone: true, email: true } } } },
        statusHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true } } } },
        assignmentHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true } } } },
      },
    });
    if (!ticket) throw notFound('TICKET_NOT_FOUND', 'تیکت پیدا نشد یا دسترسی مشاهده آن را ندارید.', 'Ticket was not found or you cannot view it.');
    return ticket;
  }

  async reply(userId: string, roles: string[], ticketId: string, data: { body: string; attachmentId?: string; internal?: boolean }) {
    const staff = isStaff(roles);
    const ticket = await this.db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw notFound('TICKET_NOT_FOUND', 'تیکت پیدا نشد.', 'Ticket was not found.');
    if (!staff && ticket.userId !== userId) throw forbidden('TICKET_OWNERSHIP_REQUIRED', 'اجازه پاسخ به این تیکت را ندارید.', 'You cannot reply to this ticket.');
    if (!staff && data.internal) throw forbidden('INTERNAL_NOTE_STAFF_ONLY', 'یادداشت داخلی فقط برای تیم پشتیبانی است.', 'Internal notes are staff-only.');
    if (ticket.status === 'CLOSED') throw badRequest('TICKET_CLOSED', 'این تیکت بسته است. برای موضوع جدید تیکت تازه ایجاد کنید.', 'This ticket is closed. Create a new ticket for a new issue.');
    const internal = staff && !!data.internal;
    const nextStatus: TicketStatus = internal ? ticket.status : staff ? 'WAITING_USER' : 'WAITING_SUPPORT';
    return this.db.$transaction(async (tx) => {
      const reply = await tx.ticketReply.create({
        data: {
          ticketId, authorId: userId, authorRole: authorRole(roles), body: data.body.trim(), attachmentId: data.attachmentId,
          internal, direction: internal ? 'INTERNAL' : staff ? 'OUTBOUND' : 'INBOUND', messageType: internal ? 'INTERNAL_NOTE' : staff ? 'STAFF_REPLY' : 'USER_MESSAGE',
        },
        include: { author: { select: { id: true, name: true, phone: true } } },
      });
      await tx.ticket.update({ where: { id: ticketId }, data: { status: nextStatus, lastReplyAt: new Date() } });
      if (nextStatus !== ticket.status) await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: nextStatus, actorId: userId, note: 'Status changed automatically after reply' } });
      if (!internal) {
        const targetUserId = staff ? ticket.userId : ticket.assignedToId;
        if (targetUserId) await tx.notification.create({
          data: {
            userId: targetUserId, type: 'TICKET_REPLY', titleFa: 'پاسخ جدید تیکت', titleEn: 'New ticket reply',
            bodyFa: `برای تیکت «${ticket.subject}» پاسخ جدید ثبت شد.`, bodyEn: `A new reply was added to “${ticket.subject}”.`,
            data: { ticketId, href: staff ? `/dashboard/tickets/${ticketId}` : `/admin/tickets/${ticketId}` },
            deliveries: { create: { channel: 'IN_APP', status: 'sent', sentAt: new Date() } },
          },
        });
      }
      return reply;
    });
  }

  async changeStatus(actorId: string, roles: string[], ticketId: string, status: TicketStatus, note?: string) {
    if (!isStaff(roles)) throw forbidden('TICKET_STATUS_STAFF_ONLY', 'فقط تیم پشتیبانی می‌تواند وضعیت تیکت را تغییر دهد.', 'Only support staff can change ticket status.');
    return this.db.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw notFound('TICKET_NOT_FOUND', 'تیکت پیدا نشد.', 'Ticket was not found.');
      if (ticket.status === status) return ticket;
      const updated = await tx.ticket.update({ where: { id: ticketId }, data: { status } });
      await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: status, actorId, note: note?.trim() || null } });
      await tx.ticketReply.create({ data: { ticketId, authorId: actorId, authorRole: authorRole(roles), direction: 'SYSTEM', messageType: 'SYSTEM', internal: false, body: `STATUS:${ticket.status}->${status}` } });
      await tx.notification.create({ data: { userId: ticket.userId, type: 'TICKET_STATUS_CHANGED', titleFa: 'وضعیت تیکت تغییر کرد', titleEn: 'Ticket status changed', bodyFa: `وضعیت تیکت «${ticket.subject}» به ${status} تغییر کرد.`, bodyEn: `The status of “${ticket.subject}” changed to ${status}.`, data: { ticketId, status, href: `/dashboard/tickets/${ticketId}` } } });
      return updated;
    });
  }

  async assign(actorId: string, roles: string[], ticketId: string, assignedToId: string | null, note?: string) {
    if (!isStaff(roles)) throw forbidden('TICKET_ASSIGNMENT_STAFF_ONLY', 'فقط تیم پشتیبانی می‌تواند مسئول تیکت را تعیین کند.', 'Only support staff can assign tickets.');
    if (assignedToId) {
      const assignee = await this.db.user.findFirst({ where: { id: assignedToId, roles: { some: { role: { in: STAFF_ROLES } } }, status: 'ACTIVE' }, include: { roles: true } });
      if (!assignee) throw badRequest('TICKET_ASSIGNEE_INVALID', 'مسئول انتخاب‌شده کاربر فعال پشتیبانی نیست.', 'The selected assignee is not an active support user.', { assignedToId: { fa: 'یک مدیر، کارشناس یا پشتیبان فعال را انتخاب کنید.', en: 'Select an active administrator, staff member, or support agent.' } });
    }
    const result = await this.db.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw notFound('TICKET_NOT_FOUND', 'تیکت پیدا نشد.', 'Ticket was not found.');
      const updated = await tx.ticket.update({ where: { id: ticketId }, data: { assignedToId, status: assignedToId && ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status } });
      await tx.ticketAssignmentHistory.create({ data: { ticketId, fromAssigneeId: ticket.assignedToId, toAssigneeId: assignedToId, actorId, note: note?.trim() || null } });
      if (assignedToId && ticket.status === 'OPEN') await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', actorId, note: 'Ticket assigned' } });
      let notificationId: string | undefined;
      if (assignedToId) {
        const notification = await tx.notification.create({
          data: {
            userId: assignedToId, type: 'TICKET_ASSIGNED', titleFa: 'تیکت جدید به شما ارجاع شد', titleEn: 'A ticket was assigned to you',
            bodyFa: `رسیدگی به تیکت «${ticket.subject}» به شما واگذار شد.`, bodyEn: `You were assigned the ticket “${ticket.subject}”.`,
            data: { ticketId, href: `/admin/tickets/${ticketId}` }, deliveries: { create: { channel: 'IN_APP', status: 'sent', sentAt: new Date() } },
          },
        });
        notificationId = notification.id;
      }
      return { updated, notificationId };
    });
    if (assignedToId && result.notificationId) await this.sendAssignmentSmsIfEnabled(assignedToId, result.notificationId, ticketId);
    return result.updated;
  }

  notifications(userId: string) { return this.db.notification.findMany({ where: { userId }, include: { deliveries: true }, orderBy: { createdAt: 'desc' }, take: 100 }); }
  read(userId: string, id: string) { return this.db.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } }); }
  page(slug: string) { return this.db.cmsPage.findFirst({ where: { slug, published: true } }); }
  settings() { return this.db.setting.findMany({ where: { public: true } }); }

  private async sendAssignmentSmsIfEnabled(userId: string, notificationId: string, ticketId: string) {
    const [user, preference] = await Promise.all([
      this.db.user.findUnique({ where: { id: userId }, select: { phone: true } }),
      this.db.notificationPreference.findUnique({ where: { userId_type: { userId, type: 'TICKET_ASSIGNED' } } }),
    ]);
    if (!user || preference?.sms === false) return;
    const delivery = await this.db.notificationDelivery.create({ data: { notificationId, channel: 'SMS', status: 'sending', attempts: 1 } });
    try {
      const cfg = config();
      let providerId: string, providerResponse: Prisma.InputJsonValue;
      if (cfg.KAVENEGAR_API_KEY) {
        const response = await fetch(`https://api.kavenegar.com/v1/${cfg.KAVENEGAR_API_KEY}/verify/lookup.json?receptor=${encodeURIComponent(user.phone)}&token=${encodeURIComponent(ticketId.slice(-8))}&template=lingospeak-ticket`, { method: 'POST' });
        providerResponse = await response.json() as Prisma.InputJsonValue;
        if (!response.ok) throw new Error('SMS provider rejected ticket assignment');
        providerId = `kavenegar-${Date.now()}`;
      } else {
        providerId = `development-${Date.now()}`;
        providerResponse = { adapter: 'development', ticketId };
      }
      await this.db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'sent', providerId, providerResponse, sentAt: new Date() } });
    } catch (error) {
      await this.db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'failed', providerResponse: { error: error instanceof Error ? error.message : 'SMS delivery failed' } } });
    }
  }
}
