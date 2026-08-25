import { TeachersService } from './teachers.service';

describe('TeachersService application persistence', () => {
  it('replaces language links with two bulk statements regardless of language count', async () => {
    const tx = {
      teacher: {
        upsert: jest.fn().mockResolvedValue({ id: 'teacher-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'teacher-1' }),
      },
      teacherLanguage: { deleteMany: jest.fn(), createMany: jest.fn() },
      userRole: { upsert: jest.fn() },
    };
    const db = {
      language: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'fa', nameEn: 'Persian' },
          { id: 'en', nameEn: 'English' },
          { id: 'de', nameEn: 'German' },
        ]),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new TeachersService(db as never, {} as never);

    await service.application('user-12345', {
      nameFa: 'مدرس نمونه',
      nameEn: 'Example Teacher',
      bioFa: 'زندگی‌نامه معتبر برای مدرس نمونه',
      bioEn: 'A valid biography for the example teacher',
      specialties: ['conversation'],
      languageIds: ['fa', 'en', 'de'],
      levels: ['B2'],
      experienceYears: 5,
    });

    expect(tx.teacherLanguage.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.teacherLanguage.createMany).toHaveBeenCalledTimes(1);
    expect(tx.teacherLanguage.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ teacherId: 'teacher-1', languageId: 'fa' }),
        expect.objectContaining({ teacherId: 'teacher-1', languageId: 'de' }),
      ]),
    });
  });
});
