'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MappedPixel, PaletteColor, hexToRgb } from '../utils/pixelation';
import { ColorSystem, getMardToHexMapping } from '../utils/colorSystemUtils';
import { usePixelEditingOperations } from '../hooks/usePixelEditingOperations';
import { useManualEditingState } from '../hooks/useManualEditingState';
import PixelatedPreviewCanvas from './PixelatedPreviewCanvas';
import FloatingColorPalette from './FloatingColorPalette';
import FloatingToolbar from './FloatingToolbar';
import { mergeSimilarColors, recalculateColorStats, TRANSPARENT_KEY } from '../utils/pixelEditingUtils';
import { getColorKeyByHex } from '../utils/colorSystemUtils';

interface PatternEditorProps {
  pattern: {
    id: number;
    name: string;
    mappedData: MappedPixel[][] | null;
    gridDimensions: { N: number; M: number } | null;
    colorCounts: { [key: string]: { count: number; color: string } } | null;
    totalBeadCount: number;
  };
  colorSystem: ColorSystem;
  activePalette: PaletteColor[];
  onSave: (updatedPattern: {
    mappedData: MappedPixel[][];
    colorCounts: { [key: string]: { count: number; color: string } };
    totalBeadCount: number;
  }) => void;
  onClose: () => void;
  /** 为 true 时不显示右侧浮动工具栏（调色盘、放大镜、退出） */
  hideFloatingToolbar?: boolean;
}

// 编辑历史记录快照
interface EditHistorySnapshot {
  mappedPixelData: MappedPixel[][];
  colorCounts: { [key: string]: { count: number; color: string } };
  totalBeadCount: number;
}

const PatternEditor: React.FC<PatternEditorProps> = ({
  pattern,
  colorSystem,
  activePalette,
  onSave,
  onClose,
  hideFloatingToolbar = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mappedPixelData, setMappedPixelData] = useState<MappedPixel[][] | null>(pattern.mappedData);
  const [colorCounts, setColorCounts] = useState<{ [key: string]: { count: number; color: string } } | null>(pattern.colorCounts);
  const [totalBeadCount, setTotalBeadCount] = useState<number>(pattern.totalBeadCount);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isMagnifierActive, setIsMagnifierActive] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(30);
  const [showFullPalette, setShowFullPalette] = useState(false);
  
  // 撤销/重做历史记录
  const [editHistory, setEditHistory] = useState<EditHistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const maxHistorySize = 20; // 最多保存20步历史

  const editingState = useManualEditingState();
  const { isManualColoringMode, enterManualMode, exitManualMode, isBrushMode, isEyedropperMode } = editingState;

  // 初始化时进入编辑模式并保存初始状态
  useEffect(() => {
    enterManualMode();
    // 保存初始状态到历史记录
    if (pattern.mappedData && pattern.colorCounts) {
      const initialSnapshot: EditHistorySnapshot = {
        mappedPixelData: JSON.parse(JSON.stringify(pattern.mappedData)),
        colorCounts: JSON.parse(JSON.stringify(pattern.colorCounts)),
        totalBeadCount: pattern.totalBeadCount
      };
      setEditHistory([initialSnapshot]);
      setHistoryIndex(0);
    }
  }, [enterManualMode, pattern.mappedData, pattern.colorCounts, pattern.totalBeadCount]);
  
  // 保存当前状态到历史记录
  const saveToHistoryRef = useRef<NodeJS.Timeout | null>(null);
  const isUndoRedoRef = useRef(false);
  
  // 使用 ref 存储最新数据，避免闭包问题
  const dataRef = useRef({ mappedPixelData, colorCounts, totalBeadCount });
  useEffect(() => {
    dataRef.current = { mappedPixelData, colorCounts, totalBeadCount };
  }, [mappedPixelData, colorCounts, totalBeadCount]);
  
  const saveToHistory = useCallback(() => {
    const { mappedPixelData: currentData, colorCounts: currentCounts, totalBeadCount: currentTotal } = dataRef.current;
    
    if (!currentData || !currentCounts || isUndoRedoRef.current) return;
    
    // 清除之前的延迟保存
    if (saveToHistoryRef.current) {
      clearTimeout(saveToHistoryRef.current);
    }
    
    // 延迟保存，避免频繁操作时保存过多快照（减少延迟时间）
    saveToHistoryRef.current = setTimeout(() => {
      // 再次检查，避免在延迟期间状态变化
      if (isUndoRedoRef.current) return;
      
      const { mappedPixelData: latestData, colorCounts: latestCounts, totalBeadCount: latestTotal } = dataRef.current;
      if (!latestData || !latestCounts) return;
      
      const snapshot: EditHistorySnapshot = {
        mappedPixelData: JSON.parse(JSON.stringify(latestData)), // 深拷贝
        colorCounts: JSON.parse(JSON.stringify(latestCounts)),
        totalBeadCount: latestTotal
      };
      
      // 使用函数式更新确保获取最新的状态
      setEditHistory(prev => {
        setHistoryIndex(currentIndex => {
          // 如果当前不在历史记录末尾，删除后面的记录（分支编辑）
          const newHistory = prev.slice(0, currentIndex + 1);
          // 添加新快照
          const updated = [...newHistory, snapshot];
          // 限制历史记录数量
          const finalHistory = updated.slice(-maxHistorySize);
          const newIndex = Math.min(currentIndex + 1, finalHistory.length - 1);
          
          // 同步更新历史记录和索引
          setEditHistory(finalHistory);
          setHistoryIndex(newIndex);
          
          return currentIndex; // 临时返回当前索引
        });
        return prev; // 临时返回
      });
    }, 150); // 减少到150ms防抖，提高响应速度
  }, []);
  
  // 撤销
  const handleUndo = useCallback(() => {
    // 清除待保存的历史记录
    if (saveToHistoryRef.current) {
      clearTimeout(saveToHistoryRef.current);
      saveToHistoryRef.current = null;
    }
    
    // 标记为撤销操作，避免触发历史记录保存
    isUndoRedoRef.current = true;
    
    // 使用函数式更新确保获取最新的状态
    setEditHistory(currentHistory => {
      setHistoryIndex(currentIndex => {
        if (currentIndex <= 0) {
          isUndoRedoRef.current = false;
          return currentIndex;
        }
        
        const prevIndex = currentIndex - 1;
        const snapshot = currentHistory[prevIndex];
        
        if (!snapshot) {
          console.error('历史记录数据不完整', { currentIndex, prevIndex, historyLength: currentHistory.length });
          isUndoRedoRef.current = false;
          return currentIndex;
        }
        
        // 立即更新状态
        setMappedPixelData(JSON.parse(JSON.stringify(snapshot.mappedPixelData)));
        setColorCounts(JSON.parse(JSON.stringify(snapshot.colorCounts)));
        setTotalBeadCount(snapshot.totalBeadCount);
        
        // 重置标记（延迟确保useEffect不会触发）
        setTimeout(() => {
          isUndoRedoRef.current = false;
        }, 150);
        
        return prevIndex;
      });
      return currentHistory;
    });
  }, []);
  
  // 重做
  const handleRedo = useCallback(() => {
    // 清除待保存的历史记录
    if (saveToHistoryRef.current) {
      clearTimeout(saveToHistoryRef.current);
      saveToHistoryRef.current = null;
    }
    
    // 标记为重做操作，避免触发历史记录保存
    isUndoRedoRef.current = true;
    
    // 使用函数式更新确保获取最新的历史记录和索引
    setEditHistory(currentHistory => {
      setHistoryIndex(currentIndex => {
        if (currentIndex >= currentHistory.length - 1) {
          isUndoRedoRef.current = false;
          return currentIndex;
        }
        
        const nextIndex = currentIndex + 1;
        const snapshot = currentHistory[nextIndex];
        
        if (!snapshot) {
          console.error('历史记录数据不完整', { currentIndex, nextIndex, historyLength: currentHistory.length });
          isUndoRedoRef.current = false;
          return currentIndex;
        }
        
        // 立即更新状态
        setMappedPixelData(JSON.parse(JSON.stringify(snapshot.mappedPixelData)));
        setColorCounts(JSON.parse(JSON.stringify(snapshot.colorCounts)));
        setTotalBeadCount(snapshot.totalBeadCount);
        
        // 重置标记（延迟确保useEffect不会触发）
        setTimeout(() => {
          isUndoRedoRef.current = false;
        }, 150);
        
        return nextIndex;
      });
      return currentHistory;
    });
  }, []);

  // 包装编辑操作，在每次操作后保存历史记录
  const handlePixelDataChange = useCallback((newData: MappedPixel[][]) => {
    setMappedPixelData(newData);
  }, []);
  
  // 当数据变化时保存历史记录（排除撤销/重做操作）
  useEffect(() => {
    // 如果是撤销/重做操作，不保存历史记录
    if (isUndoRedoRef.current) {
      return; // 不重置标记，让setTimeout来处理
    }
    
    // 只有在有初始历史记录后才开始保存（排除初始化时）
    if (mappedPixelData && colorCounts && editHistory.length > 0 && historyIndex >= 0) {
      saveToHistory();
    }
  }, [mappedPixelData, colorCounts, totalBeadCount, saveToHistory, editHistory.length, historyIndex]);
  
  const handleColorCountsChange = useCallback((newCounts: { [key: string]: { count: number; color: string } }) => {
    setColorCounts(newCounts);
  }, []);
  
  const handleTotalCountChange = useCallback((newTotal: number) => {
    setTotalBeadCount(newTotal);
  }, []);
  
  const editingOperations = usePixelEditingOperations({
    mappedPixelData,
    gridDimensions: pattern.gridDimensions,
    colorCounts,
    totalBeadCount,
    onPixelDataChange: handlePixelDataChange,
    onColorCountsChange: handleColorCountsChange,
    onTotalCountChange: handleTotalCountChange
  });

  // 获取当前使用的颜色列表
  const currentColors = React.useMemo(() => {
    if (!colorCounts) return [];
    return Object.entries(colorCounts).map(([hex, data]) => ({
      key: getColorKeyByHex(hex, colorSystem, activePalette) || hex,
      color: hex
    }));
  }, [colorCounts, colorSystem, activePalette]);

  // 获取余色色板（用户在前一页选择的所有颜色，即activePalette）
  const remainingColors = React.useMemo(() => {
    return activePalette.map(p => ({
      key: getColorKeyByHex(p.hex, colorSystem, activePalette) || p.key,
      color: p.hex
    }));
  }, [activePalette, colorSystem]);

  // 获取完整调色板颜色列表（所有豆子颜色）
  const fullPaletteColors = React.useMemo(() => {
    const mardToHexMapping = getMardToHexMapping();
    return Object.entries(mardToHexMapping)
      .map(([mardKey, hex]) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return null;
        // 根据当前色号系统获取对应的key
        const colorKey = getColorKeyByHex(hex, colorSystem, activePalette) || mardKey;
        return { key: colorKey, color: hex };
      })
      .filter((color): color is { key: string; color: string } => color !== null);
  }, [colorSystem, activePalette]);

  // 处理画布交互
  const handleCanvasInteraction = useCallback((
    clientX: number,
    clientY: number,
    pageX: number,
    pageY: number,
    isClick: boolean,
    isTouchEnd?: boolean
  ) => {
    console.log('handleCanvasInteraction called:', { clientX, clientY, isClick, isManualColoringMode });
    
    if (!canvasRef.current || !mappedPixelData || !pattern.gridDimensions) {
      console.log('Canvas interaction skipped: missing refs or data', {
        hasCanvasRef: !!canvasRef.current,
        hasMappedData: !!mappedPixelData,
        hasGridDimensions: !!pattern.gridDimensions
      });
      return;
    }
    
    // 如果不是点击操作，直接返回（用于鼠标移动等）
    if (!isClick) {
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // 计算实际的cellSize（考虑CSS缩放）
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const actualX = x * scaleX;
    const actualY = y * scaleY;
    
    const cellSize = canvas.width / pattern.gridDimensions.N;
    const col = Math.floor(actualX / cellSize);
    const row = Math.floor(actualY / cellSize);
    
    console.log('Canvas click calculation:', {
      clientX, clientY,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      canvasSize: { width: canvas.width, height: canvas.height },
      scale: { scaleX, scaleY },
      actualPos: { actualX, actualY },
      cellSize,
      gridPos: { row, col }
    });

    if (row < 0 || row >= pattern.gridDimensions.M || col < 0 || col >= pattern.gridDimensions.N) {
      console.log('Canvas interaction skipped: out of bounds', { row, col, bounds: { M: pattern.gridDimensions.M, N: pattern.gridDimensions.N } });
      return;
    }

    const cell = mappedPixelData[row]?.[col];
    if (!cell) {
      console.log('Canvas interaction skipped: no cell data', { row, col });
      return;
    }

    console.log('Canvas interaction:', { 
      isClick, 
      row, 
      col, 
      cellKey: cell.key,
      isEraseMode: editingState.isEraseMode,
      selectedColor: editingState.selectedColor?.key,
      colorReplaceState: editingState.colorReplaceState
    });

    // 取色笔模式
    if (editingState.isEyedropperMode && isClick) {
      // 从画布取色
      console.log('Eyedropper: picking color from canvas:', { key: cell.key, color: cell.color });
      if (!cell.isExternal && cell.key) {
        // 获取颜色对应的key
        const colorKey = getColorKeyByHex(cell.color, colorSystem, activePalette) || cell.key;
        editingState.selectColor({ key: colorKey, color: cell.color });
        // 取色后自动关闭取色笔模式
        editingState.setIsEyedropperMode(false);
      }
      return;
    }

    // 颜色替换模式
    if (editingState.colorReplaceState.isActive) {
      if (editingState.colorReplaceState.step === 'select-source' && isClick) {
        // 从画布选择源颜色
        console.log('Selecting source color from canvas:', { key: cell.key, color: cell.color });
        editingState.selectSourceColorFromCanvas({ key: cell.key, color: cell.color });
      }
      // 注意：目标颜色选择在调色盘中完成，不需要在画布上点击
      return;
    }

    // 区域擦除模式
    if (editingState.isEraseMode && isClick) {
      console.log('Performing flood fill erase:', { row, col, targetKey: cell.key });
      editingOperations.performFloodFillErase(row, col, cell.key);
      return;
    }

    // 区域填充模式：用当前选中的颜色填充与点击处同色且连通的区域
    if (editingState.isFillMode && isClick) {
      if (editingState.selectedColor && editingState.selectedColor.key !== TRANSPARENT_KEY && editingState.selectedColor.key !== 'ERASE') {
        editingOperations.performFloodFillPaint(row, col, cell.key, editingState.selectedColor);
      }
      return;
    }

    // 手动上色模式（包括橡皮擦和画笔）
    // 允许在没有选择颜色时也能操作（使用区域擦除模式）
    if (isClick) {
      // 标记正在编辑，防止自动保存触发
      isEditingRef.current = true;
      
      if (editingState.selectedColor) {
        // 如果选择的是橡皮擦
        if (editingState.selectedColor.key === 'ERASE' || editingState.selectedColor.key === TRANSPARENT_KEY) {
          console.log('Performing erase with selected eraser:', { row, col, targetKey: cell.key });
          editingOperations.performFloodFillErase(row, col, cell.key);
        } else {
          // 正常上色（单点或画笔模式）
          if (editingState.isBrushMode) {
            // 画笔模式：连续绘制
            console.log('Performing brush paint:', { row, col, newColor: editingState.selectedColor });
            editingOperations.performSinglePixelPaint(row, col, editingState.selectedColor);
          } else {
            // 单点模式
            console.log('Performing single pixel paint:', { row, col, newColor: editingState.selectedColor });
            editingOperations.performSinglePixelPaint(row, col, editingState.selectedColor);
          }
        }
      } else if (editingState.isEraseMode) {
        // 如果没有选择颜色但处于擦除模式，执行区域擦除
        console.log('Performing erase in erase mode:', { row, col, targetKey: cell.key });
        editingOperations.performFloodFillErase(row, col, cell.key);
      } else {
        // 如果没有选择颜色，提示用户先选择颜色
        console.log('No color selected, please select a color first');
      }
      
      // 延迟重置编辑标记，确保自动保存不会立即触发
      setTimeout(() => {
        isEditingRef.current = false;
      }, 300);
    }
  }, [mappedPixelData, pattern.gridDimensions, editingState, editingOperations, isBrushMode]);

  // 自动合并相似颜色
  const handleMergeSimilarColors = useCallback(() => {
    if (!mappedPixelData || !pattern.gridDimensions) return;

    // 标记正在合并操作，阻止自动保存
    isMergingRef.current = true;

    // 保存当前状态到历史记录
    saveToHistory();

    const result = mergeSimilarColors(
      mappedPixelData,
      pattern.gridDimensions,
      activePalette,
      similarityThreshold
    );

    if (result.mergedCount > 0) {
      setMappedPixelData(result.newPixelData);
      const { colorCounts: newColorCounts, totalCount: newTotalCount } = recalculateColorStats(result.newPixelData);
      setColorCounts(newColorCounts);
      setTotalBeadCount(newTotalCount);
      // 合并操作后保存历史记录
      setTimeout(() => {
        saveToHistory();
        // 延迟重置合并标记，确保自动保存不会立即触发
        setTimeout(() => {
          isMergingRef.current = false;
        }, 600); // 600ms后重置，确保自动保存的500ms防抖已经完成
      }, 100);
      alert(`成功合并 ${result.mergedCount} 种相似颜色！`);
    } else {
      alert('没有找到相似的颜色可以合并。');
      // 如果没有合并，立即重置标记
      setTimeout(() => {
        isMergingRef.current = false;
      }, 100);
    }
  }, [mappedPixelData, pattern.gridDimensions, activePalette, similarityThreshold, saveToHistory]);

  // 自动保存功能 - 当数据变化时自动保存
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const isMergingRef = useRef(false); // 标记是否正在合并操作
  const isEditingRef = useRef(false); // 标记是否正在编辑操作（防止编辑时触发自动保存）
  
  // 初始化时记录初始状态
  useEffect(() => {
    if (pattern.mappedData && pattern.colorCounts && !isInitializedRef.current) {
      const initialState = JSON.stringify({
        mappedData: pattern.mappedData,
        colorCounts: pattern.colorCounts,
        totalBeadCount: pattern.totalBeadCount
      });
      lastSavedRef.current = initialState;
      isInitializedRef.current = true;
      hasUserEditedRef.current = false; // 重置编辑标记
    }
  }, [pattern.mappedData, pattern.colorCounts, pattern.totalBeadCount]);
  
  // 标记用户已编辑（当历史记录增加时）
  useEffect(() => {
    if (isInitializedRef.current && editHistory.length > 1) {
      hasUserEditedRef.current = true;
    }
  }, [editHistory.length]);
  
  // 自动保存功能已禁用 - 只在手动点击保存按钮时保存
  // useEffect(() => {
  //   // 如果还未初始化，不保存
  //   if (!isInitializedRef.current) return;
  //   
  //   // 如果用户还没有进行任何编辑，不保存（避免初始化时触发）
  //   if (!hasUserEditedRef.current) return;
  //   
  //   // 如果正在合并操作，不保存（避免合并后立即关闭编辑器）
  //   if (isMergingRef.current) return;
  //   
  //   // 如果正在编辑操作，不保存（避免编辑时触发自动保存导致闪回）
  //   if (isEditingRef.current) return;
  //   
  //   if (!mappedPixelData || !colorCounts || isUndoRedoRef.current) return;
  //   
  //   // 生成当前状态的唯一标识
  //   const currentState = JSON.stringify({
  //     mappedData: mappedPixelData,
  //     colorCounts,
  //     totalBeadCount
  //   });
  //   
  //   // 如果状态没有变化，不保存
  //   if (currentState === lastSavedRef.current) return;
  //   
  //   // 清除之前的延迟保存
  //   if (autoSaveRef.current) {
  //     clearTimeout(autoSaveRef.current);
  //   }
  //   
  //   // 延迟自动保存，避免频繁保存
  //   autoSaveRef.current = setTimeout(() => {
  //     if (!mappedPixelData || !colorCounts || isUndoRedoRef.current) return;
  //     
  //     const stateToSave = JSON.stringify({
  //       mappedData: mappedPixelData,
  //       colorCounts,
  //       totalBeadCount
  //     });
  //     
  //     // 再次检查状态是否变化
  //     if (stateToSave !== lastSavedRef.current) {
  //       onSave({
  //         mappedData: mappedPixelData,
  //         colorCounts,
  //         totalBeadCount
  //       });
  //       lastSavedRef.current = stateToSave;
  //     }
  //   }, 500); // 500ms防抖，避免频繁保存
  //   
  //   return () => {
  //     if (autoSaveRef.current) {
  //       clearTimeout(autoSaveRef.current);
  //     }
  //   };
  // }, [mappedPixelData, colorCounts, totalBeadCount, onSave, editHistory.length]);
  
  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z 或 Cmd+Z: 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y 或 Ctrl+Shift+Z 或 Cmd+Shift+Z: 重做
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  if (!pattern.mappedData || !pattern.gridDimensions) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <p className="text-gray-900 dark:text-white">图纸数据不完整，无法编辑</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white dark:bg-gray-800 shadow-xl w-full h-full overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            编辑图纸：{pattern.name}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 撤销/重做按钮 */}
            <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                title="撤销 (Ctrl+Z)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={handleRedo}
                disabled={editHistory.length === 0 || historyIndex >= editHistory.length - 1}
                className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                title="重做 (Ctrl+Y)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">相似度阈值:</label>
              <input
                type="number"
                min="10"
                max="100"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <button
              onClick={handleMergeSimilarColors}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
              title="自动合并相似颜色和杂色"
            >
              自动合并相似颜色
            </button>
            <button
              onClick={() => {
                // 立即保存当前状态
                if (mappedPixelData && colorCounts) {
                  // 清除延迟保存，立即保存
                  if (autoSaveRef.current) {
                    clearTimeout(autoSaveRef.current);
                  }
                  onSave({
                    mappedData: mappedPixelData,
                    colorCounts,
                    totalBeadCount
                  });
                  // 更新已保存状态
                  const currentState = JSON.stringify({
                    mappedData: mappedPixelData,
                    colorCounts,
                    totalBeadCount
                  });
                  lastSavedRef.current = currentState;
                  alert('保存成功！');
                }
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              title="手动保存当前更改"
            >
              保存
            </button>
            <button
              onClick={() => {
                // 关闭前确保保存最新状态
                if (mappedPixelData && colorCounts) {
                  // 清除延迟保存，立即保存
                  if (autoSaveRef.current) {
                    clearTimeout(autoSaveRef.current);
                  }
                  onSave({
                    mappedData: mappedPixelData,
                    colorCounts,
                    totalBeadCount
                  });
                }
                onClose();
              }}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
            >
              关闭
            </button>
          </div>
        </div>

        {/* 画布区域 - 完全展开，保持原始比例 */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-0" onClick={(e) => e.stopPropagation()}>
          <div className="relative flex items-center justify-center" style={{ minWidth: 'fit-content', minHeight: 'fit-content' }} onClick={(e) => e.stopPropagation()}>
            <PixelatedPreviewCanvas
              mappedPixelData={mappedPixelData}
              gridDimensions={pattern.gridDimensions}
              isManualColoringMode={isManualColoringMode}
              canvasRef={canvasRef}
              onInteraction={handleCanvasInteraction}
              highlightColorKey={editingState.highlightColorKey}
              onHighlightComplete={editingState.clearHighlight}
            />
          </div>
        </div>

        {/* 浮动工具栏（hideFloatingToolbar 时隐藏） */}
        {!hideFloatingToolbar && (
          <FloatingToolbar
            isManualColoringMode={isManualColoringMode}
            isPaletteOpen={isPaletteOpen}
            onTogglePalette={() => setIsPaletteOpen(!isPaletteOpen)}
            onExitManualMode={exitManualMode}
            onToggleMagnifier={() => setIsMagnifierActive(!isMagnifierActive)}
            isMagnifierActive={isMagnifierActive}
          />
        )}

        {/* 浮动颜色选择器 */}
        {isPaletteOpen && (
          <FloatingColorPalette
            colors={currentColors}
            remainingColors={remainingColors}
            selectedColor={editingState.selectedColor}
            onColorSelect={editingState.selectColor}
            selectedColorSystem={colorSystem}
            isEraseMode={editingState.isEraseMode}
            onEraseToggle={editingState.toggleEraseMode}
            isBrushMode={editingState.isBrushMode}
            onBrushToggle={editingState.toggleBrushMode}
            isFillMode={editingState.isFillMode}
            onFillToggle={editingState.toggleFillMode}
            isEyedropperMode={isEyedropperMode}
            onEyedropperToggle={editingState.toggleEyedropperMode}
            fullPaletteColors={fullPaletteColors}
            colorReplaceState={editingState.colorReplaceState}
            onColorReplaceToggle={editingState.toggleColorReplaceMode}
            onColorReplace={(sourceColor, targetColor) => {
              console.log('Color replace called:', { sourceColor, targetColor });
              const replaceCount = editingOperations.performColorReplace(sourceColor, targetColor);
              console.log('Color replace result:', { replaceCount });
              if (replaceCount > 0) {
                editingState.completeColorReplace();
              } else {
                alert('没有找到匹配的颜色可以替换');
              }
            }}
            onHighlightColor={editingState.setHighlight}
            isOpen={isPaletteOpen}
            onToggleOpen={() => setIsPaletteOpen(!isPaletteOpen)}
            isActive={isManualColoringMode}
            onActivate={enterManualMode}
          />
        )}
      </div>
    </div>
  );
};

export default PatternEditor;
