'use client';

import React, { useEffect } from 'react';

export default function Home() {
  // 重定向到消耗豆子页面
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.href = '/consume-beads';
    }
  }, []);
  
  // 返回加载提示，因为会立即重定向
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">正在跳转...</p>
      </div>
    </div>
  );
}
