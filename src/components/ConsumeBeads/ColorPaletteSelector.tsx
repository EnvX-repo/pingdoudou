'use client';

import React from 'react';
import { PaletteColor } from '../../utils/pixelation';
import { ColorSystem, getDisplayColorKey } from '../../utils/colorSystemUtils';

interface ColorPaletteSelectorProps {
  palette: PaletteColor[];
  selectedColors: Set<string>;
  colorSystem: ColorSystem;
  onColorToggle: (colorHex: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

const ColorPaletteSelector: React.FC<ColorPaletteSelectorProps> = ({
  palette,
  selectedColors,
  colorSystem,
  onColorToggle,
  onSelectAll,
  onClearAll,
}) => {
  return (
    <div>
      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={onSelectAll}
          className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 rounded transition-colors"
        >
          全选
        </button>
        <button
          onClick={onClearAll}
          className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors"
        >
          清空
        </button>
      </div>

      {/* 颜色网格 */}
      <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {palette.map((color) => {
            const isSelected = selectedColors.has(color.hex);
            const displayKey = getDisplayColorKey(color.hex, colorSystem);

            return (
              <div key={color.hex} className="flex flex-col items-center">
                <button
                  onClick={() => onColorToggle(color.hex)}
                  className={`
                    relative w-12 h-12 rounded border-2 transition-all
                    ${isSelected 
                      ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-300 dark:ring-blue-600' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }
                  `}
                  style={{ backgroundColor: color.hex }}
                  title={`${displayKey} - ${color.hex}`}
                >
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white drop-shadow-lg"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
                {/* 显示颜色编号 */}
                <span className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-center leading-tight">
                  {displayKey}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ColorPaletteSelector;
