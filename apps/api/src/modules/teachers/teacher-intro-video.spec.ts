import { TeachersService } from './teachers.service';
import { VerificationService } from './verification.service';

describe('required teacher introduction video', () => {
  it('does not submit an application without a finalized canonical video', async () => {
    const db = {
      teacher: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'teacher-1',
          userId: 'user-1',
          status: 'DRAFT',
          introVideoKey: null,
          introVideoFileId: null,
          languageLinks: [{ languageId: 'en' }],
          verificationItems: [
            { kind: 'identity', status: 'SUBMITTED' },
            { kind: 'certificate', status: 'APPROVED' },
          ],
        }),
      },
      storedFile: { findFirst: jest.fn() },
    };
    const service = new TeachersService(db as never, {} as never);

    await expect(service.submit('user-1')).rejects.toMatchObject({
      response: { code: 'TEACHER_INTRO_VIDEO_REQUIRED' },
    });
  });

  it('attaches only a safe video uploaded for the teacher intro purpose', async () => {
    const db = {
      storedFile: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new VerificationService(db as never);

    await expect(service.introVideo('user-1', 'file-1')).rejects.toMatchObject({
      response: { code: 'INTRO_VIDEO_INVALID' },
    });
    expect(db.storedFile.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'file-1',
        ownerId: 'user-1',
        status: 'SAFE',
        purpose: 'teacher-intro-video',
      }),
    });
  });

  it('stores the canonical file relation together with the compatibility key', async () => {
    const file = { id: 'file-1', key: 'teacher/user-1/intro.mp4' };
    const tx = {
      teacher: { update: jest.fn().mockResolvedValue({ id: 'teacher-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      storedFile: { findFirst: jest.fn().mockResolvedValue(file) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    await new VerificationService(db as never).introVideo('user-1', 'file-1');

    expect(tx.teacher.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { introVideoFileId: 'file-1', introVideoKey: 'teacher/user-1/intro.mp4' },
    });
  });

  it('signs only the safe canonical video of an approved public teacher', async () => {
    const db = {
      teacher: {
        findFirst: jest.fn().mockResolvedValue({
          introVideoFile: { key: 'teacher/user-1/intro.mp4', mimeType: 'video/mp4' },
        }),
      },
    };
    const files = { createDownloadUrl: jest.fn().mockResolvedValue('https://storage/signed') };
    const service = new TeachersService(db as never, {} as never, files as never);

    await expect(service.publicIntroVideo('sara')).resolves.toEqual({
      url: 'https://storage/signed',
      mimeType: 'video/mp4',
    });
    expect(db.teacher.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [{ id: 'sara' }, { slug: 'sara' }],
        status: 'APPROVED',
        introVideoFile: { is: expect.objectContaining({ status: 'SAFE', purpose: 'teacher-intro-video' }) },
      }),
      select: { introVideoFile: { select: { key: true, mimeType: true } } },
    });
    expect(files.createDownloadUrl).toHaveBeenCalledWith('teacher/user-1/intro.mp4');
  });

  it('does not issue a URL when no eligible public video exists', async () => {
    const db = { teacher: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new TeachersService(db as never, {} as never, { createDownloadUrl: jest.fn() } as never);

    await expect(service.publicIntroVideo('missing')).rejects.toMatchObject({
      response: { code: 'TEACHER_INTRO_VIDEO_NOT_FOUND' },
    });
  });
});
