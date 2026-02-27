'use client';

import React from 'react';

interface GeneratedPatternPreviewProps {
  imageUrl: string;
}

const GeneratedPatternPreview: React.FC<GeneratedPatternPreviewProps> = ({ imageUrl }) => {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">生成的图案预览</h3>
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
        <img
          src={imageUrl}
          alt="生成的图案"
          className="max-w-full h-auto rounded"
        />
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          图案已生成，正在跳转到像素化处理页面...
        </p>
      </div>
    </div>
  );
};

export default GeneratedPatternPreview;
