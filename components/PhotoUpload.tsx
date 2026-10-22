"use client";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
};

// Photo picker with numbered thumbnails, so each item row can point back to "Photo 2".
export default function PhotoUpload({ files, onChange, disabled }: Props) {
  return (
    <div>
      <label className="inline-block cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium hover:bg-zinc-50">
        Choose photos
        <input
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            onChange(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      <span className="ml-3 text-sm text-zinc-600">
        {files.length === 0 ? "1–5 photos of the pile (3 is ideal)" : `${files.length} selected`}
      </span>

      {files.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {files.map((file, i) => (
            <figure key={i} className="w-24 text-center text-xs text-zinc-600">
              {file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Photo ${i + 1}`}
                  className="h-24 w-24 rounded-md border border-zinc-200 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 p-1">
                  {file.name}
                </div>
              )}
              <figcaption className="mt-1 font-medium">Photo {i + 1}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
