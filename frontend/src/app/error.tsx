"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold text-gray-800 font-mono">500</p>
        <h1 className="text-xl font-semibold text-gray-200 mt-4">Something went wrong</h1>
        <p className="text-sm text-gray-500 mt-2">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-[11px] text-gray-700 mt-2 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
