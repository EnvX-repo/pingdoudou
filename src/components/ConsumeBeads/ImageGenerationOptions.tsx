'use client';

import React from 'react';
import { GenerationMode } from '../../app/consume-beads/page';

interface ImageGenerationOptionsProps {
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
}

const ImageGenerationOptions: React.FC<ImageGenerationOptionsProps> = ({
  mode,
  onModeChange,
  prompt,
  onPromptChange,
}) => {
  return (
    <div className="space-y-4">
      {/* 生成模式选择 */}
      <div>
        <label className="block text-sm font-medium mb-2">生成模式：</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onModeChange('preset')}
            className={`
              px-4 py-2 rounded-lg border-2 transition-all text-sm
              ${mode === 'preset'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
            `}
          >
            📚 预设图案
          </button>
          <button
            onClick={() => onModeChange('algorithm')}
            className={`
              px-4 py-2 rounded-lg border-2 transition-all text-sm
              ${mode === 'algorithm'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
            `}
          >
            🎨 算法生成
          </button>
          <button
            onClick={() => onModeChange('ai')}
            className={`
              px-4 py-2 rounded-lg border-2 transition-all text-sm
              ${mode === 'ai'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
            `}
          >
            🤖 AI生成
          </button>
        </div>
      </div>

      {/* 模式说明 */}
      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        {mode === 'preset' && (
          <p>从内置图案库中筛选主要使用你选择颜色的图案。无需API key。</p>
        )}
        {mode === 'algorithm' && (
          <p>使用算法生成简单的几何图案。无需API key。</p>
        )}
        {mode === 'ai' && (
          <p>使用AI生成创意图案。需要配置图像生成API key（如OpenAI DALL-E）。</p>
        )}
      </div>

      {/* AI模式下的提示词输入 */}
      {mode === 'ai' && (
        <div>
          <label className="block text-sm font-medium mb-2">
            提示词（可选，留空将使用默认提示）：
          </label>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="例如：可爱的小猫、抽象几何图案、风景画..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 resize-none"
            rows={3}
          />
        </div>
      )}
    </div>
  );
};

export default ImageGenerationOptions;
