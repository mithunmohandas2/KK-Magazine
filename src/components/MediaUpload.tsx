'use client';

import { useRef, useState } from 'react';
import { compressImage, maxSourceImageBytes, type ImageCrop } from '@/lib/compress-image';
import type { MediaAsset, MediaKind, MediaPurpose } from '@/lib/data';
import { mediaRules } from '@/lib/media-spec';
import ImageCropDialog from './ImageCropDialog';
import { useSuccessToast } from './ToastProvider';

type UploadGrant = {
  id: string;
  timestamp: number;
  ticket: string;
  endpoint: string;
  fields: Record<string, string>;
};
type UploadReceipt = Pick<UploadGrant, 'id' | 'timestamp' | 'ticket'> & {
  name: string; kind: MediaKind; purpose?: MediaPurpose; contributorId?: string;
};

async function requestMedia<T>(body: object): Promise<T> {
  const response = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-KK-Request': '1' },
    body: JSON.stringify(body),
  });
  if (response.status === 401) window.location.assign('/login');
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.error || 'The media request failed.');
  }
  return response.json();
}

export default function MediaUpload({ imageOnly = false, purpose, contributorId, busy, onBusyChange, onUploaded }: {
  imageOnly?: boolean;
  purpose?: MediaPurpose;
  contributorId?: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onUploaded: (asset: MediaAsset) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const notify = useSuccessToast();
  const [receipt, setReceipt] = useState<UploadReceipt | null>(null);
  const cropPhoto = Boolean(purpose);
  const kinds: MediaKind[] = imageOnly || cropPhoto ? ['image'] : ['image', 'video'];
  const formats = kinds.flatMap(kind => mediaRules[kind].formats).filter(format => !cropPhoto || format !== 'gif');
  const accept = formats.map(format => `.${format}`).join(',');

  async function register(value: UploadReceipt) {
    const asset = await requestMedia<MediaAsset>({ action: 'complete', ...value });
    onUploaded(asset);
    notify(purpose === 'profile' ? 'Profile photo uploaded.' : cropPhoto ? 'Contributor photo uploaded.'
      : imageOnly ? 'Image uploaded and attached to the draft.' : `Added ${asset.name} to the media library.`);
    setReceipt(null);
  }

  async function runUpload(operation: () => Promise<void>) {
    setUploading(true);
    onBusyChange(true);
    setError('');
    try {
      await operation();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The upload failed.');
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }

  function selectFile(file?: File) {
    if (busy || receipt) return;
    if (!file?.size) {
      setError('Choose a file that is not empty.');
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const kind = formats.includes(extension) && kinds.find(kind => mediaRules[kind].formats.includes(extension));
    if (!kind) {
      setError(cropPhoto ? 'Choose a JPG, PNG, WebP or AVIF photo.'
        : imageOnly ? 'Choose a JPG, PNG, GIF, WebP or AVIF image.' : 'Choose a supported image or an MP4 or WebM video.');
      return;
    }
    if (kind === 'image') {
      setError('');
      if (file.size > maxSourceImageBytes) {
        setError('Choose an image up to 20 MB.');
        return;
      }
      setCropFile(file);
    } else {
      void upload(file, kind);
    }
  }

  function clearFile() {
    if (input.current) input.current.value = '';
  }

  function upload(file: File, kind: MediaKind, crop?: ImageCrop) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return runUpload(async () => {
      const uploadFile = kind === 'image' ? await compressImage(file, extension, crop) : file;
      const { id, timestamp, ticket, endpoint, fields } = await requestMedia<UploadGrant>({
        action: 'sign', kind, purpose, contributorId, bytes: uploadFile.size,
      });
      const body = new FormData();
      for (const [key, value] of Object.entries(fields)) body.set(key, value);
      body.set('file', uploadFile);
      const response = await fetch(endpoint, { method: 'POST', body });
      if (!response.ok) throw new Error('Cloudinary rejected the upload. Check the file format and try again.');
      const value: UploadReceipt = { id, timestamp, ticket, kind, purpose, contributorId, name: file.name.slice(0, 200) };
      clearFile();
      setReceipt(value);
      await register(value);
    });
  }

  return <div className={imageOnly || cropPhoto ? 'stack' : 'panel stack'}>
    <label>{cropPhoto ? 'Upload photo' : imageOnly ? 'Image file' : 'Image or video'}
      <input className="field" ref={input} type="file" accept={accept} disabled={busy || Boolean(receipt)}
        onChange={cropPhoto ? event => {
          selectFile(event.currentTarget.files?.[0]);
          clearFile();
        } : undefined} />
    </label>
    {(!cropPhoto || receipt) && <div className="button-row">
      {!cropPhoto && <button type="button" className={imageOnly ? 'btn' : 'btn primary'}
        disabled={busy || Boolean(receipt)} onClick={() => selectFile(input.current?.files?.[0])}>
        {uploading ? 'Processing…' : imageOnly ? 'Upload image' : 'Upload to library'}
      </button>}
      {receipt && <button type="button" className="btn" disabled={busy} onClick={() => runUpload(() => register(receipt))}>
        Retry adding uploaded file
      </button>}
      {receipt && <button type="button" className="btn" disabled={busy} onClick={() => {
        setReceipt(null);
        setError('');
      }}>Choose another file</button>}
    </div>}
    {!imageOnly && !cropPhoto && <p className="muted text-sm">Uploads are limited to 10 MB for images and 50 MB for MP4 or WebM videos.</p>}
    {cropPhoto && uploading && <p className="muted text-sm" role="status">Processing photo…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {cropFile && <ImageCropDialog file={cropFile} portrait={cropPhoto} onClose={() => setCropFile(null)}
      onApply={crop => {
        setCropFile(null);
        void upload(cropFile, 'image', crop);
      }} />}
  </div>;
}
