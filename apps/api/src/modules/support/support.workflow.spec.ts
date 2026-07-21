import { SupportService } from './support.service';

describe('SupportService status and assignment history', () => {
  it('persists a status transition, history, system message, and user notification', async () => {
    const tx = {
      ticket: { findUnique: jest.fn().mockResolvedValue({ id: 'ticket-1', userId: 'student-1', subject: 'Help', status: 'OPEN' }), update: jest.fn().mockResolvedValue({ id: 'ticket-1', status: 'IN_PROGRESS' }) },
      ticketStatusHistory: { create: jest.fn() }, ticketReply: { create: jest.fn() }, notification: { create: jest.fn() },
    };
    const service = new SupportService({ $transaction: jest.fn((callback) => callback(tx)) } as any);
    await service.changeStatus('support-1', ['SUPPORT'], 'ticket-1', 'IN_PROGRESS');
    expect(tx.ticketStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', actorId: 'support-1' }) });
    expect(tx.ticketReply.create).toHaveBeenCalledWith({ data: expect.objectContaining({ messageType: 'SYSTEM', direction: 'SYSTEM' }) });
    expect(tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'student-1', type: 'TICKET_STATUS_CHANGED' }) });
  });

  it('records assignment history and creates an assignee notification', async () => {
    const tx = {
      ticket: { findUnique: jest.fn().mockResolvedValue({ id: 'ticket-1', assignedToId: null, status: 'OPEN', subject: 'Help' }), update: jest.fn().mockResolvedValue({ id: 'ticket-1', assignedToId: 'support-2' }) },
      ticketAssignmentHistory: { create: jest.fn() }, ticketStatusHistory: { create: jest.fn() }, notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) },
    };
    const db = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'support-2', roles: [{ role: 'SUPPORT' }] }), findUnique: jest.fn().mockResolvedValue({ phone: '09120000011' }) },
      $transaction: jest.fn((callback) => callback(tx)),
      notificationPreference: { findUnique: jest.fn().mockResolvedValue({ sms: false }) },
    } as any;
    const service = new SupportService(db);
    await service.assign('admin-1', ['ADMIN'], 'ticket-1', 'support-2');
    expect(tx.ticketAssignmentHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ fromAssigneeId: null, toAssigneeId: 'support-2', actorId: 'admin-1' }) });
    expect(tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'support-2', type: 'TICKET_ASSIGNED' }) });
  });
});
