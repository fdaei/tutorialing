export type UploadPurpose = string;

export type UploadSource = Readonly<{
  body: Blob;
  originalName: string;
  mimeType: string;
  purpose: UploadPurpose;
}>;

export type CreateUploadRequest = Readonly<{
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  purpose: UploadPurpose;
}>;

export type UploadResponse = Readonly<{
  fileId: string;
  uploadUrl: string;
}>;

export type UploadResult = Readonly<{ fileId: string }>;
export type UploadOptions = Readonly<{ signal?: AbortSignal }>;
