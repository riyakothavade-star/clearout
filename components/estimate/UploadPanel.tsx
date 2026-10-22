"use client";

import { useRef, useState } from "react";
import { AlertIcon, CloseIcon, ImageIcon, RefreshIcon, UploadIcon } from "@/components/icons";
import type { PreparedPhoto } from "@/lib/client/preparePhoto";
import { MAX_PHOTOS } from "@/lib/schema";

type Props = {
  photos: PreparedPhoto[];
  preparing: number;
  disabled: boolean;
  setError: string | null;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onReplace: (id: string, file: File) => void;
};

export function UploadPanel({ photos, preparing, disabled, setError, onAdd, onRemove, onReplace }: Props) {
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const full = photos.length >= MAX_PHOTOS;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) onAdd(Array.from(e.dataTransfer.files));
        }}
        className={`rounded-[var(--radius-card)] border-2 border-dashed px-5 py-8 text-center transition-colors ${
          dragging ? "border-forest-700 bg-forest-50" : "border-line-strong bg-canvas"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <UploadIcon className="mx-auto h-8 w-8 text-forest-700" />
        <p className="mt-3 font-semibold text-ink">Drag photos here, or choose them from your device</p>
        <p id="upload-help" className="mt-1 text-sm text-muted">
          1–{MAX_PHOTOS} photos of the pile. Three photos from different angles usually work best. JPEG or PNG.
        </p>
        <button
          type="button"
          disabled={disabled || full}
          onClick={() => addInput.current?.click()}
          aria-describedby="upload-help"
          className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImageIcon className="h-4 w-4" /> {photos.length ? "Add more photos" : "Choose photos"}
        </button>
        <input
          ref={addInput}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            onAdd(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={replaceInput}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && replacing.current) onReplace(replacing.current, file);
            replacing.current = null;
            e.target.value = "";
          }}
        />
      </div>

      {setError && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> {setError}
        </p>
      )}

      {(photos.length > 0 || preparing > 0) && (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Selected photos">
          {photos.map((photo, i) => (
            <li key={photo.id} className={`overflow-hidden rounded-[var(--radius-control)] border bg-surface ${photo.status === "error" ? "border-danger-200" : "border-line"}`}>
              {photo.status === "ready" ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data URL thumbnail
                <img src={photo.thumbUrl} alt={`Photo ${i + 1}: ${photo.name}`} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-danger-50 px-2 text-center">
                  <AlertIcon className="h-5 w-5 text-danger-700" />
                  <span className="text-xs font-medium text-danger-700">Can&rsquo;t use this file</span>
                </div>
              )}
              <div className="px-2.5 py-2">
                <p className="text-xs font-semibold text-ink">Photo {i + 1}</p>
                <p className="truncate text-xs text-muted" title={photo.name}>{photo.name}</p>
                {photo.status === "error" && <p className="mt-1 text-xs leading-snug text-danger-700">{photo.message}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      replacing.current = photo.id;
                      replaceInput.current?.click();
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-sunken disabled:opacity-50"
                    aria-label={`Replace photo ${i + 1}`}
                  >
                    <RefreshIcon className="h-3.5 w-3.5" /> Replace
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemove(photo.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-sunken disabled:opacity-50"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <CloseIcon className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
          {Array.from({ length: preparing }, (_, i) => (
            <li key={`preparing-${i}`} className="flex aspect-[4/3] items-center justify-center rounded-[var(--radius-control)] border border-line bg-sunken text-xs text-muted">
              Preparing photo…
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
