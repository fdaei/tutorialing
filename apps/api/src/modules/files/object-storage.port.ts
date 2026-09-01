import type { Readable } from 'stream';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  createUploadUrl(input: {
    key: string;
    contentType: string;
    contentLength: number;
    checksum: string;
  }): Promise<string>;
  putObject(input: {
    key: string;
    body: Readable;
    contentType: string;
    contentLength: number;
    checksum: string;
  }): Promise<void>;
  headObject(key: string): Promise<{ contentLength?: number; contentType?: string; checksum?: string } | null>;
  createDownloadUrl(key: string): Promise<string>;
}
