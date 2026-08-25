import { SupportService } from './support.service';

describe('SupportService status and assignment history', () => {
  it('limits a regular user ticket list to tickets owned by that user', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = new SupportService({
      ticket: { findMany, count },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as any);

    await service.list('student-1', ['STUDENT'], { page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'student-1' } }));
    expect(count).toHaveBeenCalledWith({ where: { userId: 'student-1' } });
  });

  it('persists a status transition, history, system message, and user notification', async () => {
    const tx = {
      ticket: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'ticket-1', userId: 'student-1', subject: 'Help', status: 'OPEN' }),
        update: jest.fn().mockResolvedValue({ id: 'ticket-1', status: 'IN_PROGRESS' }),
      },
      ticketStatusHistory: { create: jest.fn() },
      ticketReply: { create: jest.fn() },
      notification: { create: jest.fn() },
    };
    const service = new SupportService({ $transaction: jest.fn((callback) => callback(tx)) } as any);
    await service.changeStatus('support-1', ['SUPPORT'], 'ticket-1', 'IN_PROGRESS');
    expect(tx.ticketStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', actorId: 'support-1' }),
    });
    expect(tx.ticketReply.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ messageType: 'SYSTEM', direction: 'SYSTEM' }),
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'student-1', type: 'TICKET_STATUS_CHANGED' }),
    });
  });

  it('records assignment history and creates an assignee notification', async () => {
    const tx = {
      ticket: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'ticket-1', assignedToId: null, status: 'OPEN', subject: 'Help' }),
        update: jest.fn().mockResolvedValue({ id: 'ticket-1', assignedToId: 'support-2' }),
      },
      ticketAssignmentHistory: { create: jest.fn() },
      ticketStatusHistory: { create: jest.fn() },
      notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) },
    };
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'support-2', roles: [{ role: 'SUPPORT' }] }),
        findUnique: jest.fn().mockResolvedValue({ phone: '09120000011' }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
      notificationPreference: { findUnique: jest.fn().mockResolvedValue({ sms: false }) },
    } as any;
    const service = new SupportService(db);
    await service.assign('admin-1', ['ADMIN'], 'ticket-1', 'support-2');
    expect(tx.ticketAssignmentHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fromAssigneeId: null, toAssigneeId: 'support-2', actorId: 'admin-1' }),
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'support-2', type: 'TICKET_ASSIGNED' }),
    });
  });
});

describe('SupportService.detail (SEC-210)', () => {
  const TICKET = { id: 'ticket-1', userId: 'user-a', subject: 'Help', replies: [], statusHistory: [], assignmentHistory: [] };

  /** Mirrors `detail()`'s real `where` shape (`id` plus, for a non-staff
   * caller, `userId`) closely enough that a different authenticated user
   * genuinely gets no match. */
  function harness() {
    const findFirst = jest.fn().mockImplementation(({ where }: { where: { id: string; userId?: string } }) => {
      const matches = where.id === TICKET.id && (where.userId === undefined || where.userId === TICKET.userId);
      return Promise.resolve(matches ? TICKET : null);
    });
    const service = new SupportService({ ticket: { findFirst } } as any);
    return { service, findFirst };
  }

  it('rejects a different (non-staff) user requesting another user’s ticket', async () => {
    const { service } = harness();
    await expect(service.detail('user-b', ['STUDENT'], TICKET.id)).rejects.toMatchObject({
      response: { code: 'TICKET_NOT_FOUND' },
    });
  });

  it('still lets the owning user read their own ticket', async () => {
    const { service } = harness();
    await expect(service.detail('user-a', ['STUDENT'], TICKET.id)).resolves.toMatchObject({ id: TICKET.id });
  });

  it('lets staff read a ticket they do not own', async () => {
    const { service } = harness();
    await expect(service.detail('support-1', ['SUPPORT'], TICKET.id)).resolves.toMatchObject({ id: TICKET.id });
  });
});
