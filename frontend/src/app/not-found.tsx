import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold text-gray-800 font-mono">404</p>
        <h1 className="text-xl font-semibold text-gray-200 mt-4">Page not found</h1>
        <p className="text-sm text-gray-500 mt-2">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
