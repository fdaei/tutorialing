import { upload } from '@/shared/services/upload';
import { uploadSpeakingAudio } from './upload-speaking-audio';

jest.mock('@/shared/services/upload', () => ({ upload: jest.fn() }));

const mockedUpload = jest.mocked(upload);

describe('speaking audio upload orchestration', () => {
  beforeEach(() => mockedUpload.mockResolvedValue({ fileId: 'audio-1' }));

  afterEach(() => mockedUpload.mockReset());

  it('preserves the speaking purpose and normalizes codec MIME types', async () => {
    const blob = new Blob(['audio'], { type: 'audio/webm;codecs=opus' });
    await expect(uploadSpeakingAudio(blob)).resolves.toBe('audio-1');
    expect(mockedUpload).toHaveBeenCalledWith({
      body: blob,
      originalName: 'speaking-answer.webm',
      mimeType: 'audio/webm',
      purpose: 'speaking-answer',
    });
  });
});
