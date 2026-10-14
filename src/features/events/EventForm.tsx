"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteEvent, saveStandaloneEvent } from "./actions";

export type EventDraft = { id?: string; kind: "contest" | "personal"; title: string; local: string };

type Props = { initial: EventDraft; onClose: () => void };

/** Add/edit form for contest/personal events. Remount (key) it to reset. */
export function EventForm({ initial, onClose }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState(initial.kind);
  const [title, setTitle] = useState(initial.title);
  const [startsAt, setStartsAt] = useState(initial.local);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      try {
        const result = await saveStandaloneEvent({ id: initial.id, kind, title, startsAt });
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
        onClose();
      } catch {
        setError("저장하지 못했어요. 다시 시도해 주세요");
      }
    });

  const remove = () => {
    setConfirming(false);
    const id = initial.id;
    if (!id) return;
    startTransition(async () => {
      try {
        await deleteEvent(id);
        router.refresh();
        onClose();
      } catch {
        setError("삭제하지 못했어요. 다시 시도해 주세요");
      }
    });
  };

  return (
    <section aria-label="일정 편집" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span>종류</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "contest" | "personal")}
          className="rounded-md border px-2 py-1"
        >
          <option value="contest">공모전</option>
          <option value="personal">개인</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>이름</span>
        <input
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>날짜와 시간</span>
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="rounded-md border px-2 py-1"
        />
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="rounded-md bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
      >
        저장
      </button>
      {initial.id && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="rounded-md px-3 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          삭제
        </button>
      )}
      <button type="button" onClick={onClose} className="rounded-md px-3 py-1 hover:bg-gray-100">
        취소
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-600">
          {error}
        </p>
      )}
      {confirming && (
        <ConfirmDialog
          title="이 일정을 삭제할까요?"
          message="삭제한 일정은 되돌릴 수 없어요."
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
