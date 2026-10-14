"use client";

import { useEffect, useRef } from "react";

type Props = { title: string; message: string; onConfirm: () => void; onCancel: () => void };

export function ConfirmDialog({ title, message, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-96 rounded-lg p-6 shadow-xl backdrop:bg-black/40"
    >
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <p className="mb-6 text-sm text-gray-700">{message}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 hover:bg-gray-100">
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-700"
        >
          삭제
        </button>
      </div>
    </dialog>
  );
}
