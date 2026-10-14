"use client";

/** Error boundary for the signed-in pages: a Korean message and a retry instead of Next's English page. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="space-y-4">
      <h1 className="text-2xl font-bold">문제가 생겼어요</h1>
      <p className="text-gray-700">잠시 후 다시 시도해 주세요.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-gray-900 px-3 py-2 text-white hover:bg-gray-700"
      >
        다시 시도
      </button>
    </div>
  );
}
