import { upload } from '@/shared/services/upload';
import { uploadPanelFile } from './upload-panel-file';

jest.mock('@/shared/services/upload', () => ({ upload: jest.fn() }));

const mockedUpload = jest.mocked(upload);

describe('panel upload validation', () => {
  beforeEach(() => mockedUpload.mockResolvedValue({ fileId: 'panel-file-1' }));

  afterEach(() => mockedUpload.mockReset());

  it('keeps validation in the panel feature and delegates valid files', async () => {
    const file = new File(['video'], 'intro.webm', { type: 'video/webm' });
    await expect(uploadPanelFile(file, 'teacher-intro-video', true)).resolves.toBe('panel-file-1');
    expect(mockedUpload).toHaveBeenCalledWith({
      body: file,
      originalName: 'intro.webm',
      mimeType: 'video/webm',
      purpose: 'teacher-intro-video',
    });
  });

  it('rejects unsupported files before transport', async () => {
    const file = new File(['script'], 'script.js', { type: 'text/javascript' });
    await expect(uploadPanelFile(file, 'teacher-verification', true)).rejects.toBeInstanceOf(Error);
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});
