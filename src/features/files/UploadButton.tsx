"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mimeTypeFor, validateFile } from "@/lib/domain/files";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { registerUpload } from "./actions";

const UPLOAD_FAILED = "업로드에 실패했어요. 다시 시도해 주세요";

export function UploadButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File) {
    setError(null);
    const check = validateFile({ name: file.name, size: file.size });
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setBusy(true);
    const supabase = createBrowserSupabase();
    let uploadedPath: string | null = null;
    // Best effort: an object without a row would only be cleaned up when the course is deleted.
    const discardUpload = async () => {
      if (uploadedPath) await supabase.storage.from("materials").remove([uploadedPath]).catch(() => undefined);
    };
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setError(UPLOAD_FAILED);
        return;
      }
      const fileId = crypto.randomUUID();
      const path = `${auth.user.id}/${courseId}/${fileId}`;
      // storage-js sends a Blob's own type, so re-wrap the file with the type pinned from its extension.
      const contentType = mimeTypeFor(file.name);
      const { error: uploadError } = await supabase.storage
        .from("materials")
        .upload(path, new Blob([file], { type: contentType }), { contentType, upsert: false });
      if (uploadError) {
        setError(UPLOAD_FAILED);
        return;
      }
      uploadedPath = path;
      const res = await registerUpload({ courseId, fileId, name: file.name, size: file.size });
      if (res.error) {
        await discardUpload();
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      await discardUpload();
      setError(UPLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      <input
        ref={inputRef}
        type="file"
        aria-label="파일 선택"
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onPick(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "올리는 중..." : "파일 올리기"}
      </button>
      {error && (
        <p role="alert" data-testid="file-error" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
