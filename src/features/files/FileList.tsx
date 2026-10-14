"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { isPreviewable } from "@/lib/domain/files";
import { deleteFile, getFileUrl, renameFile } from "./actions";
import type { FileRow } from "./queries";

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** UTC ISO -> "YYYY.MM.DD" in KST. */
export function formatKstDate(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, ".");
}

export function FileList({ files }: { files: FileRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<FileRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (files.length === 0) return <p className="text-gray-500">아직 올린 파일이 없어요</p>;

  async function preview(id: string) {
    setError(null);
    // Open the tab inside the click: after the await, Safari's popup blocker would refuse it.
    // "noopener" can't be passed here (open would return null), so cut the opener link by hand.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      if (!tab) throw new Error("popup blocked");
      const url = await getFileUrl(id, "preview");
      tab.location.href = url;
    } catch {
      tab?.close();
      setError("파일을 열지 못했어요. 다시 시도해 주세요");
    }
  }

  async function download(id: string, name: string) {
    setError(null);
    try {
      const url = await getFileUrl(id, "download");
      // Storage sends a percent-encoded Content-Disposition name, so save the bytes
      // under the original (Korean) name ourselves.
      const res = await fetch(url);
      if (!res.ok) throw new Error("download failed");
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      setError("파일을 받지 못했어요. 다시 시도해 주세요");
    }
  }

  async function submitRename() {
    if (!renaming) return;
    const res = await renameFile(renaming.id, renaming.name);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRenaming(null);
    setError(null);
    router.refresh();
  }

  const btn = "rounded-md px-2 py-1 text-sm hover:bg-gray-100";
  return (
    <>
      {error && (
        <p role="alert" data-testid="file-error" className="mb-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200 text-sm text-gray-600">
            <th className="py-2">이름</th>
            <th className="py-2">크기</th>
            <th className="py-2">올린 날짜</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id} data-testid="file-row" className="border-b border-gray-100">
              <td className="py-2">
                {renaming?.id === f.id ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitRename();
                    }}
                  >
                    <input
                      aria-label="새 파일 이름"
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: f.id, name: e.target.value })}
                      className="w-64 rounded-md border border-gray-300 px-2 py-1"
                    />
                    <button type="submit" className={btn}>저장</button>
                    <button type="button" className={btn} onClick={() => { setRenaming(null); setError(null); }}>
                      취소
                    </button>
                  </form>
                ) : (
                  f.name
                )}
              </td>
              <td className="py-2">{formatSize(f.sizeBytes)}</td>
              <td className="py-2">{formatKstDate(f.createdAt)}</td>
              <td className="py-2">
                <div className="flex justify-end gap-1">
                  {isPreviewable(f.name) && (
                    <button type="button" className={btn} onClick={() => void preview(f.id)}>
                      미리보기
                    </button>
                  )}
                  <button type="button" className={btn} onClick={() => void download(f.id, f.name)}>
                    다운로드
                  </button>
                  <button
                    type="button"
                    className={btn}
                    onClick={() => { setError(null); setRenaming({ id: f.id, name: f.name }); }}
                  >
                    이름 바꾸기
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className={`${btn} text-red-600`}
                    onClick={() => setDeleting(f)}
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleting && (
        <ConfirmDialog
          title="파일 삭제"
          message={`'${deleting.name}' 파일을 삭제할까요?`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const id = deleting.id;
            setDeleting(null);
            startTransition(async () => {
              try {
                await deleteFile(id);
                router.refresh();
              } catch {
                setError("삭제하지 못했어요. 다시 시도해 주세요");
              }
            });
          }}
        />
      )}
    </>
  );
}
