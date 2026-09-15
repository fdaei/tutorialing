import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { AppModule } from '../src/app.module';

/**
 * Direct browser -> storage upload against the real MinIO from docker compose.
 *
 * Every direct upload used to fail with "There were headers present in the
 * request which were not signed" and silently fall back to streaming the file
 * through the API, and no test noticed. These PUTs carry exactly the headers
 * apps/web/src/shared/services/upload/upload-client.ts sends.
 */
describe('Direct file upload to object storage', () => {
  let app: INestApplication, token: string;
  const phone = `+989${String(Date.now()).slice(-9)}`;
  // A real 1x1 PNG.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const checksum = createHash('sha256').update(png).digest('hex');
  const browserHeaders = {
    'content-type': 'image/png',
    'x-amz-meta-checksum': checksum,
    'x-amz-checksum-sha256': createHash('sha256').update(png).digest('base64'),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    const challenge = await request(app.getHttpServer()).post('/api/auth/otp/request').send({ phone }).expect(201);
    const verified = await request(app.getHttpServer())
      .post('/api/auth/otp/verify')
      .send({ phone, challengeId: challenge.body.challengeId, code: challenge.body.developmentCode })
      .expect(201);
    token = verified.body.accessToken;
  });
  afterAll(() => app.close());

  const createUpload = () =>
    request(app.getHttpServer())
      .post('/api/files/uploads')
      .set('authorization', `Bearer ${token}`)
      .send({ originalName: 'avatar.png', mimeType: 'image/png', size: png.length, checksum, purpose: 'avatar' })
      .expect(201);

  it('accepts the web client PUT, completes, and serves back the same bytes', async () => {
    const { fileId, uploadUrl } = (await createUpload()).body;

    const put = await fetch(uploadUrl, { method: 'PUT', headers: browserHeaders, body: png });
    expect({ status: put.status, body: put.ok ? '' : await put.text() }).toEqual({ status: 200, body: '' });

    const completed = await request(app.getHttpServer())
      .post(`/api/files/${fileId}/complete`)
      .set('authorization', `Bearer ${token}`)
      .expect(201);
    expect(completed.body.status).toBe('SAFE');

    const download = await request(app.getHttpServer())
      .get(`/api/files/${fileId}/download`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    const stored = Buffer.from(await (await fetch(download.body.url)).arrayBuffer());
    expect(stored.equals(png)).toBe(true);
  });

  it('lets storage refuse a body that does not hash to the declared checksum', async () => {
    const { fileId, uploadUrl } = (await createUpload()).body;
    // Same length, one byte flipped: only a digest check can tell it apart.
    const tampered = Buffer.from(png);
    tampered.writeUInt8(tampered.readUInt8(20) ^ 0xff, 20);

    const put = await fetch(uploadUrl, { method: 'PUT', headers: browserHeaders, body: tampered });
    expect(put.status).toBe(400);
    // Refused for the digest (MinIO's code / AWS's), not for a signing problem.
    expect(await put.text()).toMatch(/<Code>(XAmzContentChecksumMismatch|BadDigest)<\/Code>/);

    await request(app.getHttpServer())
      .post(`/api/files/${fileId}/complete`)
      .set('authorization', `Bearer ${token}`)
      .expect(400);
  });

  // The fallback for when the browser can't reach storage must hold the same digest check.
  it('keeps the API fallback transport under the same checksum check', async () => {
    const tampered = Buffer.from(png);
    tampered.writeUInt8(tampered.readUInt8(20) ^ 0xff, 20);
    const rejected = (await createUpload()).body;
    const mismatch = await request(app.getHttpServer())
      .post(`/api/files/uploads/${rejected.fileId}/content`)
      .set('authorization', `Bearer ${token}`)
      .set({ 'content-type': 'image/png', 'x-content-checksum': checksum })
      .send(tampered)
      .expect(400);
    expect(mismatch.body.code).toBe('UPLOAD_CHECKSUM_MISMATCH');

    const { fileId } = (await createUpload()).body;
    await request(app.getHttpServer())
      .post(`/api/files/uploads/${fileId}/content`)
      .set('authorization', `Bearer ${token}`)
      .set({ 'content-type': 'image/png', 'x-content-checksum': checksum })
      .send(png)
      .expect(201);
    const completed = await request(app.getHttpServer())
      .post(`/api/files/${fileId}/complete`)
      .set('authorization', `Bearer ${token}`)
      .expect(201);
    expect(completed.body.status).toBe('SAFE');
  });
});
