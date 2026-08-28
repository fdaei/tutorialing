import { upload } from '@/shared/services/upload';
import { uploadSupportAttachment } from './upload-support-attachment';

jest.mock('@/shared/services/upload', () => ({ upload: jest.fn() }));

const mockedUpload = jest.mocked(upload);

describe('support attachment upload validation', () => {
  beforeEach(() => mockedUpload.mockResolvedValue({ fileId: 'attachment-1' }));

  afterEach(() => mockedUpload.mockReset());

  it('preserves support attachment metadata for valid files', async () => {
    const file = new File(['document'], 'evidence.pdf', { type: 'application/pdf' });
    await expect(uploadSupportAttachment(file, true)).resolves.toBe('attachment-1');
    expect(mockedUpload).toHaveBeenCalledWith({
      body: file,
      originalName: 'evidence.pdf',
      mimeType: 'application/pdf',
      purpose: 'support-attachment',
    });
  });

  it('rejects unsupported attachment types before transport', async () => {
    const file = new File(['archive'], 'archive.zip', { type: 'application/zip' });
    await expect(uploadSupportAttachment(file, true)).rejects.toBeInstanceOf(Error);
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});
