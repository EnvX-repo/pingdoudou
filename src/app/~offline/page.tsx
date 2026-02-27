'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
        网络已断开
      </h1>
      <p className="mb-4 text-gray-600 dark:text-gray-400">
        请检查网络连接后刷新页面
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
      >
        重新加载
      </button>
    </div>
  );
}
