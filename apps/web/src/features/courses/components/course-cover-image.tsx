'use client';

import { useEffect, useState } from 'react';
import { api } from '@/shared/services/api';

const isUploadedFileId = (value: string) => !value.includes('/') && !value.startsWith('http');

export function CourseCoverImage({ image, alt, className }: { image: string; alt: string; className?: string }) {
  const [src, setSrc] = useState(isUploadedFileId(image) ? '' : image);
  useEffect(() => {
    if (!isUploadedFileId(image)) {
      setSrc(image);
      return;
    }
    api<{ url: string }>(`/files/public/${image}`)
      .then((result) => setSrc(result.url))
      .catch(() => setSrc(''));
  }, [image]);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}
