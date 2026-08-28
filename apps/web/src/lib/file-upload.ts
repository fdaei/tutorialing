import { api } from '@/lib/api';

type UploadResponse = { fileId: string; uploadUrl: string };

export const SUPPORT_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

async function sha256(file: File) {
  const data = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(data)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function uploadFile(file: File, purpose: string) {
  const checksum = await sha256(file);
  const upload = await api<UploadResponse>('/files/uploads', {
    method: 'POST',
    body: JSON.stringify({
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      checksum,
      purpose,
    }),
  });

  let uploadedDirectly = false;
  try {
    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': file.type, 'x-amz-meta-checksum': checksum },
    });
    uploadedDirectly = response.ok;
  } catch {
    uploadedDirectly = false;
  }

  if (!uploadedDirectly) {
    await api(`/files/uploads/${upload.fileId}/content`, {
      method: 'POST',
      headers: { 'content-type': file.type, 'x-content-checksum': checksum },
      body: file,
    });
  }
  await api(`/files/${upload.fileId}/complete`, { method: 'POST' });
  return upload.fileId;
}
