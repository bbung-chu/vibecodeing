"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteAccount } from "./actions";

const FAILED = "계정을 삭제하지 못했어요. 다시 시도해 주세요";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "삭제하는 중..." : "계정 삭제"}
      </button>
      {error && (
        <p role="alert" className="px-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {confirming && (
        <ConfirmDialog
          title="계정 삭제"
          message="계정과 모든 자료가 영구히 지워져요. 삭제할까요?"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            startTransition(async () => {
              try {
                const res = await deleteAccount();
                if (res?.error) setError(res.error);
              } catch {
                setError(FAILED);
              }
            });
          }}
        />
      )}
    </>
  );
}
