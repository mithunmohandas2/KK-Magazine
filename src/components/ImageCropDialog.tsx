'use client';

import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import type { ImageCrop } from '@/lib/compress-image';

const ratios: Record<string, number> = {
  '1:1': 1, '4:3': 4 / 3, '3:2': 3 / 2, '16:9': 16 / 9, '4:5': 4 / 5, '9:16': 9 / 16,
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function ImageCropDialog({ file, portrait, onClose, onApply }: {
  file: File;
  portrait: boolean;
  onClose: () => void;
  onApply: (crop?: ImageCrop) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const drag = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const [src, setSrc] = useState('');
  const [size, setSize] = useState<{ width: number; height: number }>();
  const [mode, setMode] = useState(portrait ? '1:1' : 'none');
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [free, setFree] = useState({ width: 0.8, height: 0.8 });
  const [failed, setFailed] = useState(false);

  const cropping = mode !== 'none';
  const ratio = ratios[mode];
  const area = size && (() => {
    const width = mode === 'free' ? free.width * size.width
      : cropping ? Math.min(size.width, size.height * ratio) / zoom : size.width;
    const height = mode === 'free' ? free.height * size.height
      : cropping ? width / ratio : size.height;
    return { width, height, x: (size.width - width) * position.x, y: (size.height - height) * position.y };
  })();
  const previewRatio = area ? area.width / area.height : 1;
  const previewScale = Math.min(1, previewRatio);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    if (!dialog.current?.open) dialog.current?.showModal();
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!cropping || !area || event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { clientX: event.clientX, clientY: event.clientY, ...position };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !area || !size || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const start = drag.current;
    const scale = event.currentTarget.clientWidth / area.width;
    const xRange = (size.width - area.width) * scale;
    const yRange = (size.height - area.height) * scale;
    setPosition({
      x: xRange ? clamp(start.x - (event.clientX - start.clientX) / xRange) : start.x,
      y: yRange ? clamp(start.y - (event.clientY - start.clientY) / yRange) : start.y,
    });
  }

  function apply() {
    if (!area || !size || failed) return;
    dialog.current?.close();
    onApply(cropping ? {
      x: area.x / size.width,
      y: area.y / size.height,
      width: area.width / size.width,
      height: area.height / size.height,
    } : undefined);
  }

  return <dialog ref={dialog} className="panel studio-profile-dialog" aria-labelledby={titleId} onClose={onClose}>
    <div className="stack">
      <h2 id={titleId} className="serif">{portrait ? 'Crop photo' : 'Image crop'}</h2>
      {!portrait && <label>Aspect ratio
        <select className="field" value={mode} onChange={event => setMode(event.target.value)}>
          <option value="none">No crop</option>
          <option value="free">Free crop</option>
          {Object.keys(ratios).map(value => <option key={value}>{value}</option>)}
        </select>
      </label>}
      <div className="photo-crop-preview" data-cropping={cropping}
        style={{ width: `min(100%, ${22 * previewScale}rem, ${42 * previewScale}dvh)`, aspectRatio: previewRatio }}
        onPointerDown={startDrag} onPointerMove={moveDrag} onLostPointerCapture={() => { drag.current = null; }}>
        {src && <img src={src} alt="Image crop preview" draggable={false}
          onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={() => setFailed(true)}
          style={area && size ? {
            width: `${size.width / area.width * 100}%`, height: `${size.height / area.height * 100}%`,
            left: `${-area.x / area.width * 100}%`, top: `${-area.y / area.height * 100}%`,
          } : { visibility: 'hidden' }} />}
      </div>
      {failed && <p className="form-error" role="alert">This image could not be opened. Choose another file.</p>}
      {cropping && <fieldset className="stack photo-crop-controls" disabled={!area || failed}>
        {mode === 'free' ? <>
          <label>Crop width<input type="range" min={0.05} max={1} step={0.01} value={free.width}
            onChange={event => setFree({ ...free, width: Number(event.target.value) })} /></label>
          <label>Crop height<input type="range" min={0.05} max={1} step={0.01} value={free.height}
            onChange={event => setFree({ ...free, height: Number(event.target.value) })} /></label>
        </> : <label>Zoom<input type="range" min={1} max={4} step={0.01} value={zoom}
          onChange={event => setZoom(Number(event.target.value))} /></label>}
        <label>Horizontal position<input type="range" min={0} max={1} step={0.01} value={position.x}
          disabled={size?.width === area?.width}
          onChange={event => setPosition({ ...position, x: Number(event.target.value) })} /></label>
        <label>Vertical position<input type="range" min={0} max={1} step={0.01} value={position.y}
          disabled={size?.height === area?.height}
          onChange={event => setPosition({ ...position, y: Number(event.target.value) })} /></label>
        {/\.(gif|webp|avif)$/i.test(file.name) && <p className="muted text-sm">Cropping an animated image uploads a still image.</p>}
      </fieldset>}
      <div className="button-row studio-delete-actions">
        <button type="button" className="btn" onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="button" className="btn primary" disabled={!area || failed} onClick={apply}>
          {cropping ? 'Crop and upload' : 'Upload without cropping'}
        </button>
      </div>
    </div>
  </dialog>;
}
