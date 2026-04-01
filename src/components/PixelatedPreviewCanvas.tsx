'use client';

import React, { useRef, useEffect, TouchEvent, MouseEvent, useState } from 'react';
import { MappedPixel } from '../utils/pixelation';

interface PixelatedPreviewCanvasProps {
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  isManualColoringMode: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onInteraction: (
    clientX: number,
    clientY: number,
    pageX: number,
    pageY: number,
    isClick: boolean,
    isTouchEnd?: boolean
  ) => void;
  highlightColorKey?: string | null;
  onHighlightComplete?: () => void;
}

// 绘制像素化画布的函数
const drawPixelatedCanvas = (
  dataToDraw: MappedPixel[][],
  canvas: HTMLCanvasElement | null,
  dims: { N: number; M: number } | null,
  highlightColorKey?: string | null,
  isHighlighting?: boolean
) => {
  if (!canvas || !dims || !dataToDraw) {
    console.warn("drawPixelatedCanvas: Missing required parameters");
    return;
  }
  
  const pixelatedCtx = canvas.getContext('2d');
  if (!pixelatedCtx) {
    console.error("Failed to get 2D context for pixelated canvas");
    return;
  }

  // Respect current dark mode preference
  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  // Define colors based on mode
  const externalBackgroundColor = isDarkMode ? '#374151' : '#F3F4F6'; // gray-700 : gray-100
  const gridLineColor = isDarkMode ? '#4B5563' : '#DDDDDD'; // gray-600 : lighter gray

  const { N, M } = dims;
  const outputWidth = canvas.width;
  const outputHeight = canvas.height;
  const cellWidthOutput = outputWidth / N;
  const cellHeightOutput = outputHeight / M;

  pixelatedCtx.clearRect(0, 0, outputWidth, outputHeight);
  pixelatedCtx.lineWidth = 0.5; // Keep line width thin

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cellData = dataToDraw[j]?.[i];
      if (!cellData) continue;

      const drawX = i * cellWidthOutput;
      const drawY = j * cellHeightOutput;

      // Fill cell color using mode-specific background for external cells
      if (cellData.isExternal) {
        pixelatedCtx.fillStyle = externalBackgroundColor;
      } else {
        pixelatedCtx.fillStyle = cellData.color;
      }
      pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);

      // 如果正在高亮且当前单元格不是目标颜色，添加半透明黑色蒙版
      if (isHighlighting && highlightColorKey) {
        let shouldDim = false;
        
        if (cellData.isExternal) {
          // 外部单元格总是变深色（因为它们不是要高亮的颜色）
          shouldDim = true;
        } else {
          // 内部单元格：如果颜色不匹配则变深色
          shouldDim = cellData.color.toUpperCase() !== highlightColorKey.toUpperCase();
        }
        
        if (shouldDim) {
          pixelatedCtx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // 60% 透明度的黑色蒙版
          pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);
        }
      }

      // Draw grid lines using mode-specific color
      pixelatedCtx.strokeStyle = gridLineColor;
      pixelatedCtx.strokeRect(drawX + 0.5, drawY + 0.5, cellWidthOutput, cellHeightOutput);
    }
  }
};

const PixelatedPreviewCanvas: React.FC<PixelatedPreviewCanvasProps> = ({
  mappedPixelData,
  gridDimensions,
  isManualColoringMode,
  canvasRef,
  onInteraction,
  highlightColorKey,
  onHighlightComplete,
}) => {
  const [darkModeState, setDarkModeState] = useState<boolean | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const touchMovedRef = useRef<boolean>(false);
  const [isHighlighting, setIsHighlighting] = useState(false);

  // Effect to detect dark mode changes and update state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDarkMode = () => {
        const isDark = document.documentElement.classList.contains('dark');
        // Only update state if it actually changes
        if (isDark !== darkModeState) {
            setDarkModeState(isDark);
        }
    };

    // Initial check
    checkDarkMode();

    // Use MutationObserver to watch for class changes on <html>
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Cleanup observer on component unmount
    return () => observer.disconnect();

  }, [darkModeState]); // Depend on darkModeState to re-run if needed externally

  // 用于触发重绘的计数器（窗口 resize / 页面可见性变化时递增）
  const [redrawTrigger, setRedrawTrigger] = useState(0);

  // 监听窗口 resize 和页面可见性变化，触发 canvas 重绘
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => setRedrawTrigger(prev => prev + 1);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setRedrawTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 设置canvas尺寸，保持原始比例，足够大
  useEffect(() => {
    if (!gridDimensions || !canvasRef.current) return;

    const { N, M } = gridDimensions;
    const canvas = canvasRef.current;

    // 计算合适的cellSize，确保画布足够大且保持比例
    const minCellSize = 8;
    const maxCellSize = 30;

    // 根据可用空间计算cellSize
    // 优先考虑宽度，确保画布不会太宽
    const maxWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth * 0.9) : 800;
    const maxHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight * 0.7) : 600;

    // 计算基于宽度的cellSize
    const cellSizeByWidth = Math.floor(maxWidth / N);
    // 计算基于高度的cellSize
    const cellSizeByHeight = Math.floor(maxHeight / M);

    // 取较小的值，确保两个方向都能显示
    let cellSize = Math.min(cellSizeByWidth, cellSizeByHeight);

    // 限制在合理范围内
    cellSize = Math.max(minCellSize, Math.min(maxCellSize, cellSize));

    // 设置canvas实际尺寸（保持原始比例）
    const canvasWidth = N * cellSize;
    const canvasHeight = M * cellSize;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // CSS样式保持auto，让浏览器自动缩放显示
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';

    console.log(`Canvas size set: ${canvasWidth}x${canvasHeight} (cellSize: ${cellSize}, grid: ${N}x${M})`);
  }, [gridDimensions, redrawTrigger]);

  // Update useEffect for drawing to depend on darkModeState as well
  useEffect(() => {
    // Ensure darkModeState is not null before drawing
    if (mappedPixelData && gridDimensions && canvasRef.current && darkModeState !== null) {
      drawPixelatedCanvas(mappedPixelData, canvasRef.current, gridDimensions, highlightColorKey, isHighlighting);
    }
  }, [mappedPixelData, gridDimensions, canvasRef, darkModeState, highlightColorKey, isHighlighting, redrawTrigger]);

  // 处理高亮效果
  useEffect(() => {
    if (highlightColorKey && mappedPixelData && gridDimensions) {
      setIsHighlighting(true);
      // 0.3秒后结束高亮
      const timer = setTimeout(() => {
        setIsHighlighting(false);
        onHighlightComplete?.();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [highlightColorKey, mappedPixelData, gridDimensions, onHighlightComplete]);

  // --- 鼠标事件处理 ---
  
  // 鼠标移动时显示提示或画笔绘制
  const [isMouseDown, setIsMouseDown] = useState(false);
  
  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    // 如果在手动模式下且鼠标按下，触发画笔绘制
    if (isManualColoringMode && isMouseDown) {
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true);
    } else if (!isManualColoringMode) {
      // 只有在非手动模式下才通过mousemove显示tooltip
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, false);
    }
  };
  
  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    setIsMouseDown(true);
    if (isManualColoringMode) {
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true);
    }
  };
  
  const handleMouseUp = () => {
    setIsMouseDown(false);
  };
  
  const handleMouseLeave = () => {
    setIsMouseDown(false);
    // 鼠标离开时总是隐藏tooltip
    onInteraction(0, 0, 0, 0, false, true);
  };

  // 鼠标点击处理（用于手动上色模式）
  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // 在编辑模式下，总是传递 isClick: true
    // 让 PatternEditor 决定如何处理
    onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true);
  };

  // --- 触摸事件处理 ---
  // 用于检测触摸移动的参考
  const handleTouchStart = (event: TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    // 记录起始位置并重置移动标志
    touchStartPosRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      pageX: touch.pageX,
      pageY: touch.pageY
    };
    touchMovedRef.current = false;

    // 在非手动模式下，触摸开始时仍然可以立即显示/切换tooltip，提供即时反馈
    if (!isManualColoringMode) {
        onInteraction(touch.clientX, touch.clientY, touch.pageX, touch.pageY, false);
    }
    // 注意：此处不再触发手动上色 (isClick: true)
  };
  
  // 触摸移动时检测是否需要隐藏提示
  const handleTouchMove = (event: TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    if (!touch || !touchStartPosRef.current) return;
    
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    
    // 如果移动超过阈值，则标记为已移动，并隐藏tooltip
    // 增加一个稍大的阈值，以更好地区分点击和微小的手指抖动/滑动意图
    if (!touchMovedRef.current && (dx > 10 || dy > 10)) {
      touchMovedRef.current = true;
      // 一旦确定是移动，就隐藏tooltip
      onInteraction(0, 0, 0, 0, false, true);
    }
  };
  
  // 触摸结束时不再自动隐藏提示框
  const handleTouchEnd = () => {
    // 检查是否是手动模式，并且触摸没有移动（判定为点击）
    if (isManualColoringMode && !touchMovedRef.current && touchStartPosRef.current) {
      // 使用触摸开始时的坐标来执行上色操作
      const { x, y, pageX, pageY } = touchStartPosRef.current;
      onInteraction(x, y, pageX, pageY, true); // isClick: true 表示执行上色
    }
    // 如果是非手动模式下的点击 (isManualColoringMode=false, touchMovedRef=false)
    // Tooltip 的显示/隐藏切换已在 touchstart 处理，touchend 时无需额外操作

    // 重置触摸状态
    touchStartPosRef.current = null;
    touchMovedRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd} // 添加 onTouchCancel 以处理触摸中断的情况
      className={`border border-gray-300 dark:border-gray-600 rounded block ${
        isManualColoringMode ? 'cursor-pointer' : 'cursor-grab' // 改为 grab 光标提示可以拖动
      }`}
      style={{
        imageRendering: 'pixelated',
        width: 'auto',
        height: 'auto',
        maxWidth: '100%',
        maxHeight: '100%',
        pointerEvents: 'auto',
        userSelect: 'none', // 防止文本选择
        // touchAction: 'none' // 移除此行以允许页面滚动和缩放
      }}
    />
  );
};

export default PixelatedPreviewCanvas; 