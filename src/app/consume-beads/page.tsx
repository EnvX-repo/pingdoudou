'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getMardToHexMapping, ColorSystem, colorSystemOptions, getDisplayColorKey } from '../../utils/colorSystemUtils';
import { hexToRgb, PaletteColor, MappedPixel, calculatePixelGrid, PixelationMode, findClosestPaletteColor } from '../../utils/pixelation';
import { transparentColorData } from '../../utils/pixelEditingUtils';
import ColorPaletteSelector from '../../components/ConsumeBeads/ColorPaletteSelector';
import DownloadSettingsModal, { gridLineColorOptions } from '../../components/DownloadSettingsModal';
import { GridDownloadOptions } from '../../types/downloadTypes';
import { downloadImage } from '../../utils/imageDownloader';
import PatternEditor from '../../components/PatternEditor';

const COLOR_PRESETS_STORAGE_KEY = 'consume-beads-color-presets';
const GENERATED_PATTERNS_STORAGE_KEY = 'consume-beads-generated-patterns';

interface ColorPreset {
  id: string;
  name: string;
  colorHexes: string[];
}

function loadColorPresets(): ColorPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COLOR_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveColorPresets(presets: ColorPreset[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COLOR_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (_) {}
}

function loadGeneratedPatterns(): GeneratedPattern[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GENERATED_PATTERNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 过滤掉正在处理中的（不完整的）图纸
    return parsed.filter((p: GeneratedPattern) => !p.isProcessing && p.mappedData !== null);
  } catch {
    return [];
  }
}

function saveGeneratedPatterns(patterns: GeneratedPattern[]) {
  if (typeof window === 'undefined') return;
  try {
    // 只保存已完成的图纸（有 mappedData 的）
    const toSave = patterns.filter(p => !p.isProcessing && p.mappedData !== null);
    localStorage.setItem(GENERATED_PATTERNS_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    // localStorage 可能已满，尝试清理
    console.warn('保存图纸到 localStorage 失败:', e);
  }
}

interface GeneratedPattern {
  id: number;
  name: string;
  imageUrl: string;
  mappedData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  colorCounts: { [key: string]: { count: number; color: string } } | null;
  totalBeadCount: number;
  isProcessing: boolean;
  originalPrompt?: string; // 自定义生成时存原始关键词，用于重新生成
  originalReferenceImage?: string; // 自定义生成时存参考图，用于重新生成
}

// 历史记录快照（用于撤销）
interface HistorySnapshot {
  generatedPatterns: GeneratedPattern[];
  colorPresets: ColorPreset[];
  selectedColors: string[];
  timestamp: number;
}

// 两种画风：随机二选一；统一强调单一主体、无碎片/彩屑
const NO_FRAGMENTS =
  ' Single subject only. No confetti, no scattered dots, no fragments or specks around the subject. Clean silhouette on plain background.';
const STYLE_REALISTIC =
  'Smooth, clean 2D illustration style, cute and detailed. Use soft color transitions and well-defined shapes. ' +
  'White or plain empty background. Suitable for perler bead pattern, centered composition, avoid overly fragmented details.' + NO_FRAGMENTS;
const STYLE_CARTOON =
  'Cute kawaii cartoon style, flat 2D design, bold simple shapes, chibi proportions. ' +
  'Large expressive eyes, simplified features, solid flat colors only (no gradients, no realistic shading). ' +
  'Strong, clear outlines and high contrast colors. Each color area should have distinct, crisp edges. ' +
  'White or plain empty background. Suitable for perler bead / pixel art pattern, centered composition, very cute and recognizable.' + NO_FRAGMENTS;

function pickRandomStyle(): 'realistic' | 'cartoon' {
  return Math.random() < 0.5 ? 'realistic' : 'cartoon';
}

// 分类：动物、人物、游戏像素、食物、植物、日常物品、场景风景。子主题仅作举例，prompt 用 e.g. 开放描述，不限定只出举例项。食物类含 food/drink/beverage，并强调多样化避免总出同一项。
const CATEGORY_OPTIONS: { name: string; prompts: string[] }[] = [
  {
    name: '动物类',
    prompts: [
      'One cute cartoon animal, any species (e.g. cat, dog, rabbit, panda, dinosaur, sea creature, chick, or other), single subject, centered on white background',
      'One cute cartoon creature or pet, your choice of animal, single subject, centered on white background',
    ],
  },
  {
    name: '人物类',
    prompts: [
      'One cute cartoon or anime character (e.g. Q-version chibi, anime-style, pixel person, couple avatar, or any profession), single subject, centered on white background',
      'One cute character portrait or avatar, style and type up to you, single subject, centered on white background',
    ],
  },
  {
    name: '游戏/像素类',
    prompts: [
      'One cute game or pixel style image (e.g. 8-bit character, game character, RPG item like sword or chest, pixel icon, or similar), single subject, centered on white background',
      'One cute retro or pixel art subject of your choice, single subject, centered on white background',
    ],
  },
  {
    name: '食物类',
    prompts: [
      'One cute cartoon food or drink, pick a varied type (e.g. fruit, dessert, snack, vegetable, baked good, beverage, or other). Do not default to the same item every time. Single subject, centered on white background',
      'One cute cartoon food or beverage item—choose something different and varied, e.g. fruit, cake, drink, sandwich, or any food/drink, single subject, centered on white background',
    ],
  },
  {
    name: '植物类',
    prompts: [
      'One cute cartoon plant or nature element (e.g. flower, potted plant, four-season motif, forest element, or other), single subject, centered on white background',
      'One cute botanical or nature-themed subject, your choice, single subject, centered on white background',
    ],
  },
  {
    name: '日常物品类',
    prompts: [
      'One cute cartoon everyday object or accessory (e.g. camera, phone, star, heart, small accessory, or other), single subject, centered on white background',
      'One cute object or item of your choice, single subject, centered on white background',
    ],
  },
  {
    name: '场景/风景类',
    prompts: [
      'One cute cartoon scene or landscape element (e.g. small house, castle, starry sky, city silhouette, or other), single subject, centered on white background',
      'One cute scenery or place element, your choice, single subject, centered on white background',
    ],
  },
];

function pickRandomPrompt(category: { name: string; prompts: string[] }): { name: string; prompt: string } {
  const prompt = category.prompts[Math.floor(Math.random() * category.prompts.length)];
  return { name: category.name, prompt };
}

// 计算两个 hex 颜色之间的欧氏距离平方
function hexColorDistanceSq(hex1: string, hex2: string): number {
  const parse = (h: string) => {
    const s = h.replace('#', '');
    return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
  };
  const a = parse(hex1), b = parse(hex2);
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

// 将四边相连的”背景色”标记为不填色（external），背景留空
// 使用 4 连通 + 颜色距离阈值：4 连通不会穿过轮廓对角缝隙泄漏到主体内部
function markBackgroundAsExternal(mappedData: MappedPixel[][], N: number, M: number): MappedPixel[][] {
  const result = mappedData.map(row => row.map(cell => ({ ...cell })));
  const visited = Array(M).fill(null).map(() => Array(N).fill(false));

  // 统计边框上出现最多的颜色，视为背景色
  const borderColors: string[] = [];
  for (let i = 0; i < N; i++) {
    if (result[0][i]?.color) borderColors.push(result[0][i].color);
    if (M > 1 && result[M - 1][i]?.color) borderColors.push(result[M - 1][i].color);
  }
  for (let j = 0; j < M; j++) {
    if (result[j][0]?.color) borderColors.push(result[j][0].color);
    if (N > 1 && result[j][N - 1]?.color) borderColors.push(result[j][N - 1].color);
  }
  if (borderColors.length === 0) return result;
  const count: Record<string, number> = {};
  borderColors.forEach(c => { count[c] = (count[c] || 0) + 1; });
  const backgroundColor = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];

  // 颜色距离阈值：距离平方 < 3600（约 RGB 各差 35 以内视为同一背景色）
  const BG_DIST_THRESHOLD = 3600;

  const isBgColor = (hex: string) =>
    hex.toUpperCase() === backgroundColor.toUpperCase() ||
    hexColorDistanceSq(hex, backgroundColor) < BG_DIST_THRESHOLD;

  // 从边框出发，4 连通 flood-fill 相似背景色（不穿过对角缝隙）
  const stack: { r: number; c: number }[] = [];
  for (let i = 0; i < N; i++) {
    if (result[0][i]?.color && isBgColor(result[0][i].color)) stack.push({ r: 0, c: i });
    if (M > 1 && result[M - 1][i]?.color && isBgColor(result[M - 1][i].color)) stack.push({ r: M - 1, c: i });
  }
  for (let j = 0; j < M; j++) {
    if (result[j][0]?.color && isBgColor(result[j][0].color)) stack.push({ r: j, c: 0 });
    if (N > 1 && result[j][N - 1]?.color && isBgColor(result[j][N - 1].color)) stack.push({ r: j, c: N - 1 });
  }
  while (stack.length > 0) {
    const { r, c } = stack.pop()!;
    if (r < 0 || r >= M || c < 0 || c >= N || visited[r][c]) continue;
    const cell = result[r][c];
    if (!cell?.color || !isBgColor(cell.color)) continue;
    visited[r][c] = true;
    result[r][c] = { ...transparentColorData };
    // 4 连通：仅上下左右
    stack.push({ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 });
  }
  return sealInteriorLeaks(result, mappedData, N, M);
}

// 封边验证：找到所有不与边框相连的 external 像素群，恢复为原色
// 防止 flood fill 意外泄漏到主体内部
function sealInteriorLeaks(
  data: MappedPixel[][],
  originalData: MappedPixel[][],
  N: number,
  M: number
): MappedPixel[][] {
  const result = data.map(row => row.map(cell => ({ ...cell })));
  const visited = Array(M).fill(null).map(() => Array(N).fill(false));

  // 从边框出发，4 连通遍历所有 external 像素，标记为”确认外部”
  const stack: { r: number; c: number }[] = [];
  for (let i = 0; i < N; i++) {
    if (result[0][i]?.isExternal) stack.push({ r: 0, c: i });
    if (M > 1 && result[M - 1][i]?.isExternal) stack.push({ r: M - 1, c: i });
  }
  for (let j = 0; j < M; j++) {
    if (result[j][0]?.isExternal) stack.push({ r: j, c: 0 });
    if (N > 1 && result[j][N - 1]?.isExternal) stack.push({ r: j, c: N - 1 });
  }
  while (stack.length > 0) {
    const { r, c } = stack.pop()!;
    if (r < 0 || r >= M || c < 0 || c >= N || visited[r][c]) continue;
    if (!result[r][c]?.isExternal) continue;
    visited[r][c] = true;
    stack.push({ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 });
  }

  // 任何 external 但没被 visited 的像素 = 被困在主体内部的泄漏，恢复原色
  let restoredCount = 0;
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      if (result[j][i]?.isExternal && !visited[j][i]) {
        result[j][i] = { ...originalData[j][i], isExternal: false };
        restoredCount++;
      }
    }
  }
  if (restoredCount > 0) {
    console.log(`封边验证：恢复了 ${restoredCount} 个被误标为背景的内部像素`);
  }
  return result;
}

// 添加边缘描边：在主体边缘添加对比色描边，增强小图清晰度
function addEdgeOutline(
  mappedData: MappedPixel[][],
  N: number,
  M: number,
  palette: PaletteColor[]
): MappedPixel[][] {
  const result = mappedData.map(row => row.map(cell => ({ ...cell })));
  // 找黑色或最深的颜色作为描边色
  const blackColor = palette.find(p => p.hex.toUpperCase() === '#000000') || 
                     palette.reduce((darkest, p) => {
                       const darkestLuma = darkest.rgb.r * 0.299 + darkest.rgb.g * 0.587 + darkest.rgb.b * 0.114;
                       const pLuma = p.rgb.r * 0.299 + p.rgb.g * 0.587 + p.rgb.b * 0.114;
                       return pLuma < darkestLuma ? p : darkest;
                     });
  
  const isExternal = (r: number, c: number) => {
    if (r < 0 || r >= M || c < 0 || c >= N) return true;
    return result[r][c]?.isExternal === true;
  };
  
  const isFilled = (r: number, c: number) => {
    if (r < 0 || r >= M || c < 0 || c >= N) return false;
    return result[r][c] && !result[r][c].isExternal;
  };
  
  // 在主体边缘添加描边
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      if (!isFilled(j, i)) continue;
      
      // 检查上下左右是否有背景（external）
      const neighbors = [
        { r: j - 1, c: i },
        { r: j + 1, c: i },
        { r: j, c: i - 1 },
        { r: j, c: i + 1 },
      ];
      
      const hasExternalNeighbor = neighbors.some(n => isExternal(n.r, n.c));
      
      if (hasExternalNeighbor) {
        // 在边缘格子，如果当前颜色与描边色不同，添加描边
        // 这里我们直接在边缘格子使用描边色（简单粗暴但有效）
        // 或者可以在边缘格子的相邻背景位置添加描边（但背景是external，不能改）
        // 所以我们选择：如果边缘格子的颜色与描边色对比度不够，替换为描边色
        const currentColor = result[j][i].color;
        if (currentColor && currentColor.toUpperCase() !== blackColor.hex.toUpperCase()) {
          // 只在边缘添加描边，不替换整个格子
          // 实际上，我们可以创建一个"描边层"，但为了简单，我们直接替换边缘格子为描边色
          result[j][i] = { key: blackColor.key, color: blackColor.hex, isExternal: false };
        }
      }
    }
  }
  
  return result;
}

// 白色边缘灰色包边：在背景侧画一圈灰色（与白色相邻的 external 格子填灰色），主体白色保持不改
function addWhiteEdgeOutline(
  mappedData: MappedPixel[][],
  N: number,
  M: number,
  palette: PaletteColor[]
): MappedPixel[][] {
  const result = mappedData.map(row => row.map(cell => ({ ...cell })));
  const whiteHex = '#FFFFFF';
  const greyCandidates = ['#9E9E9E', '#808080', '#757575', '#616161', '#BDBDBD', '#E0E0E0'];
  let outlineColor = palette.find(p => greyCandidates.includes(p.hex.toUpperCase()));
  if (!outlineColor) {
    // 如果调色板没有灰色，选择最接近灰色的颜色，但排除蓝色/青色（避免包边变成蓝色）
    const isBlueish = (hex: string) => {
      const h = (hex || '').toUpperCase().replace('#', '');
      if (h.length !== 6) return false;
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return b > r + 30 && b > g + 30; // 蓝色分量明显大于 R/G
    };
    outlineColor = palette.reduce((best, p) => {
      if (isBlueish(p.hex)) return best; // 跳过蓝色/青色
      const luma = p.rgb.r * 0.299 + p.rgb.g * 0.587 + p.rgb.b * 0.114;
      const bestLuma = best.rgb.r * 0.299 + best.rgb.g * 0.587 + best.rgb.b * 0.114;
      return Math.abs(luma - 128) < Math.abs(bestLuma - 128) ? p : best;
    });
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/03a812c0-deee-4704-870e-69350ddab099',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'consume-beads/page.tsx:196',message:'addWhiteEdgeOutline selected color',data:{outlineColorHex:outlineColor.hex,outlineColorRgb:outlineColor.rgb,paletteColors:palette.map(p=>p.hex).slice(0,10)},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const hasWhiteNeighbor = (r: number, c: number) => {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    return dirs.some(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= M || nc < 0 || nc >= N) return false;
      const cell = result[nr][nc];
      return cell && !cell.isExternal && cell.color && cell.color.toUpperCase() === whiteHex;
    });
  };
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cell = result[j][i];
      if (!cell || !cell.isExternal) continue;
      if (!hasWhiteNeighbor(j, i)) continue;
      result[j][i] = { key: outlineColor.key, color: outlineColor.hex, isExternal: false };
    }
  }
  return result;
}

// 边缘密封：只保留与主体连通的豆子，去掉”东一颗西一颗”的孤立格（拼豆需连在一起）
// 使用 8 连通，避免对角连接的主体被误判为孤立
function removeIsolatedPixels(mappedData: MappedPixel[][], N: number, M: number): MappedPixel[][] {
  const result = mappedData.map(row => row.map(cell => ({ ...cell })));
  const visited = Array(M).fill(null).map(() => Array(N).fill(false));

  const isFilled = (r: number, c: number) =>
    r >= 0 && r < M && c >= 0 && c < N && result[r][c] && !result[r][c].isExternal;

  const components: { r: number; c: number }[][] = [];
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      if (visited[j][i] || !isFilled(j, i)) continue;
      const stack: { r: number; c: number }[] = [{ r: j, c: i }];
      const comp: { r: number; c: number }[] = [];
      while (stack.length > 0) {
        const { r, c } = stack.pop()!;
        if (r < 0 || r >= M || c < 0 || c >= N || visited[r][c] || !isFilled(r, c)) continue;
        visited[r][c] = true;
        comp.push({ r, c });
        // 8 连通
        stack.push(
          { r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 },
          { r: r - 1, c: c - 1 }, { r: r - 1, c: c + 1 }, { r: r + 1, c: c - 1 }, { r: r + 1, c: c + 1 }
        );
      }
      if (comp.length > 0) components.push(comp);
    }
  }
  if (components.length <= 1) return result;
  const largest = components.reduce((a, b) => (a.length >= b.length ? a : b));
  const inLargest = new Set(largest.map(p => `${p.r},${p.c}`));
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      if (result[j][i] && !result[j][i].isExternal && !inLargest.has(`${j},${i}`)) {
        result[j][i] = { ...transparentColorData };
      }
    }
  }
  return result;
}

// 确保调色板中始终包含黑色和白色（用于描边、高光等）
function ensureBlackWhiteInPalette(palette: PaletteColor[]): PaletteColor[] {
  const hasBlack = palette.some(p => p.hex.toUpperCase() === '#000000');
  const hasWhite = palette.some(p => p.hex.toUpperCase() === '#FFFFFF');
  const extra: PaletteColor[] = [];
  if (!hasBlack) extra.push({ key: '#000000', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } });
  if (!hasWhite) extra.push({ key: '#FFFFFF', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } });
  return extra.length ? [...palette, ...extra] : palette;
}

// 确保发给 AI 的颜色列表里也包含黑、白（AI 可用作描边、高光）
function ensureBlackWhiteInColorList(hexList: string[]): string[] {
  const set = new Set(hexList.map(h => h.toUpperCase()));
  const out = [...hexList];
  if (!set.has('#000000')) out.push('#000000');
  if (!set.has('#FFFFFF')) out.push('#FFFFFF');
  return out;
}

export default function ConsumeBeadsPage() {
  // 获取完整色板
  const mardToHexMapping = getMardToHexMapping();
  const fullBeadPalette: PaletteColor[] = useMemo(() => {
    return Object.entries(mardToHexMapping)
      .map(([mardKey, hex]) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return null;
        return { key: hex, hex, rgb };
      })
      .filter((color): color is PaletteColor => color !== null);
  }, []);

  // 状态管理
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [colorSystem, setColorSystem] = useState<ColorSystem>('MARD');
  const [generatedPatterns, setGeneratedPatterns] = useState<GeneratedPattern[]>(() => loadGeneratedPatterns());
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadModalPattern, setDownloadModalPattern] = useState<GeneratedPattern | null>(null);
  const [downloadOptions, setDownloadOptions] = useState<GridDownloadOptions>({
    showGrid: true,
    gridInterval: 10,
    showCoordinates: true,
    showCellNumbers: true,
    gridLineColor: gridLineColorOptions[0].value,
    includeStats: true,
    exportCsv: false,
  });

  const [colorPresets, setColorPresets] = useState<ColorPreset[]>([]);
  const [customPromptText, setCustomPromptText] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);
  const nextCustomIdRef = useRef(1000);
  const [editingPatternId, setEditingPatternId] = useState<number | null>(null);
  const autoIncludeBlackWhite = false;
  const [gridSize, setGridSize] = useState(50);
  
  // 撤销历史记录
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const maxHistorySize = 10; // 最多保存10步历史
  
  useEffect(() => {
    setColorPresets(loadColorPresets());
  }, []);

  // 持久化生成的图纸到 localStorage
  useEffect(() => {
    // 只在有完成的图纸时保存
    const completedPatterns = generatedPatterns.filter(p => !p.isProcessing && p.mappedData !== null);
    if (completedPatterns.length > 0) {
      saveGeneratedPatterns(generatedPatterns);
    }
  }, [generatedPatterns]);
  
  // 保存当前状态到历史记录
  const saveToHistory = useCallback(() => {
    const snapshot: HistorySnapshot = {
      generatedPatterns: JSON.parse(JSON.stringify(generatedPatterns)), // 深拷贝
      colorPresets: JSON.parse(JSON.stringify(colorPresets)),
      selectedColors: Array.from(selectedColors),
      timestamp: Date.now(),
    };
    setHistory(prev => {
      const newHistory = [...prev, snapshot];
      // 限制历史记录数量
      return newHistory.slice(-maxHistorySize);
    });
  }, [generatedPatterns, colorPresets, selectedColors]);
  
  // 撤销到上一步
  const handleUndo = useCallback(() => {
    if (history.length === 0) {
      alert('没有可撤销的操作');
      return;
    }
    const lastSnapshot = history[history.length - 1];
    setGeneratedPatterns(lastSnapshot.generatedPatterns);
    setColorPresets(lastSnapshot.colorPresets);
    saveColorPresets(lastSnapshot.colorPresets); // 同步保存到localStorage
    setSelectedColors(new Set(lastSnapshot.selectedColors));
    // 移除最后一条历史记录
    setHistory(prev => prev.slice(0, -1));
  }, [history]);

  const applyPreset = useCallback((preset: ColorPreset) => {
    saveToHistory(); // 保存当前状态
    const validHexes = preset.colorHexes.filter(hex =>
      fullBeadPalette.some(c => c.hex.toUpperCase() === hex.toUpperCase())
    );
    setSelectedColors(new Set(validHexes));
  }, [fullBeadPalette, saveToHistory]);

  const saveCurrentAsPreset = useCallback(() => {
    const hexes = Array.from(selectedColors);
    if (hexes.length === 0) {
      alert('请先选择至少一种颜色再保存预设');
      return;
    }
    saveToHistory(); // 保存当前状态
    const name = window.prompt('预设名称', `我的余色 ${colorPresets.length + 1}`);
    if (name == null) return;
    const trimmed = name.trim() || `预设 ${colorPresets.length + 1}`;
    const newPreset: ColorPreset = {
      id: `preset-${Date.now()}`,
      name: trimmed,
      colorHexes: hexes,
    };
    const next = [...colorPresets, newPreset];
    setColorPresets(next);
    saveColorPresets(next);
  }, [selectedColors, colorPresets, saveToHistory]);

  const updatePreset = useCallback((preset: ColorPreset) => {
    saveToHistory(); // 保存当前状态
    const hexes = Array.from(selectedColors);
    const next = colorPresets.map(p => p.id === preset.id ? { ...p, name: p.name, colorHexes: hexes } : p);
    setColorPresets(next);
    saveColorPresets(next);
  }, [selectedColors, colorPresets, saveToHistory]);

  const deletePreset = useCallback((preset: ColorPreset) => {
    if (!window.confirm(`确定删除预设「${preset.name}」？`)) return;
    saveToHistory(); // 保存当前状态
    const next = colorPresets.filter(p => p.id !== preset.id);
    setColorPresets(next);
    saveColorPresets(next);
  }, [colorPresets, saveToHistory]);

  // 颜色选择处理
  const handleColorToggle = useCallback((colorHex: string) => {
    setSelectedColors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(colorHex)) {
        newSet.delete(colorHex);
      } else {
        newSet.add(colorHex);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedColors(new Set(fullBeadPalette.map(c => c.hex)));
  }, [fullBeadPalette]);

  const handleClearAll = useCallback(() => {
    setSelectedColors(new Set());
  }, []);

  // 随机选择 3 个分类，每个分类内再随机选一条 prompt，减少重复（如总是仙人掌、奶茶、太空人）
  const getRandomTemplates = useCallback(() => {
    const shuffled = [...CATEGORY_OPTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(cat => pickRandomPrompt(cat));
  }, []);

  // 生成3套图纸
  const handleGenerate = useCallback(async () => {
    if (selectedColors.size === 0) {
      alert('请至少选择一个颜色');
      return;
    }

    // 保存当前状态到历史记录
    saveToHistory();
    setIsGenerating(true);
    
    // 随机选择3个模板
    const selectedTemplates = getRandomTemplates();
    
    // 初始化3个空模式
    const initialPatterns: GeneratedPattern[] = selectedTemplates.map((template, index) => ({
      id: index,
      name: template.name,
      imageUrl: '',
      mappedData: null,
      gridDimensions: null,
      colorCounts: null,
      totalBeadCount: 0,
      isProcessing: true
    }));
    setGeneratedPatterns(initialPatterns);

    const colors = autoIncludeBlackWhite ? ensureBlackWhiteInColorList(Array.from(selectedColors)) : Array.from(selectedColors);
    const activePalette = fullBeadPalette.filter(c => selectedColors.has(c.hex));

    // 逐个生成图像并处理：随机风格（写实/卡通）；前 2 张简单少色，第 3 张复杂多色
    for (let i = 0; i < selectedTemplates.length; i++) {
      try {
        const style = pickRandomStyle();
        const complexity: Complexity = i === 2 ? 'complex' : 'simple';
        // 生成AI图像
        let imageUrl: string;
        try {
          imageUrl = await generateAIImage(colors, selectedTemplates[i].prompt, { style, complexity });
        } catch (error: any) {
          console.error(`生成第${i + 1}套图纸失败:`, error);
          const errorMessage = error.message || '未知错误';
          
          // 更新对应的模式，显示详细错误信息
          setGeneratedPatterns(prev => {
            const updated = [...prev];
            updated[i] = {
              ...updated[i],
              isProcessing: false,
              name: `${updated[i].name} (生成失败: ${errorMessage})`
            };
            return updated;
          });
          
          // 如果是API key错误，显示提示
          if (errorMessage.includes('API密钥') || errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
            alert(`API Key配置错误或无效。\n\n错误信息：${errorMessage}\n\n请检查：\n1. .env.local 文件是否存在\n2. OPENAI_API_KEY 是否正确\n3. API Key是否有效\n\n查看 SETUP_GUIDE.md 了解详细配置说明。`);
          }
          continue; // 继续生成其他图纸
        }
        
        if (imageUrl) {
          // 处理图像转换为拼豆图纸（调色板自动包含黑白）；简单模式限制最多 6 色
          const paletteWithBW = autoIncludeBlackWhite ? ensureBlackWhiteInPalette(activePalette) : activePalette;
          const pattern = await processImageToPattern(
            imageUrl,
            selectedTemplates[i].name,
            i,
            paletteWithBW,
            colors,
            { maxColors: complexity === 'simple' ? 6 : undefined, gridSize }
          );

          // 更新对应的模式
          setGeneratedPatterns(prev => {
            const updated = [...prev];
            updated[i] = pattern;
            return updated;
          });
        }
      } catch (error) {
        console.error(`生成第${i + 1}套图纸失败:`, error);
        setGeneratedPatterns(prev => {
          const updated = [...prev];
          updated[i] = {
            ...updated[i],
            isProcessing: false,
            name: `${updated[i].name} (生成失败)`
          };
          return updated;
        });
      }
    }

    setIsGenerating(false);
  }, [selectedColors, fullBeadPalette, getRandomTemplates]);

  // 重新生成单张AI随机图纸（覆盖当前这张）
  const handleRegenerateSinglePattern = useCallback(async (patternId: number) => {
    if (selectedColors.size === 0) {
      alert('请至少选择一个颜色');
      return;
    }
    
    // 保存当前状态到历史记录
    saveToHistory();
    
    // 随机选择一个模板
    const selectedTemplates = getRandomTemplates();
    const randomTemplate = selectedTemplates[Math.floor(Math.random() * selectedTemplates.length)];
    
    // 更新当前图纸为加载状态
    setGeneratedPatterns(prev => prev.map(p => 
      p.id === patternId 
        ? { 
            ...p, 
            name: randomTemplate.name,
            imageUrl: '',
            mappedData: null,
            gridDimensions: null,
            colorCounts: null,
            totalBeadCount: 0,
            isProcessing: true 
          }
        : p
    ));
    setIsGenerating(true);
    
    const colors = autoIncludeBlackWhite ? ensureBlackWhiteInColorList(Array.from(selectedColors)) : Array.from(selectedColors);
    const activePalette = fullBeadPalette.filter(c => selectedColors.has(c.hex));
    const paletteWithBW = autoIncludeBlackWhite ? ensureBlackWhiteInPalette(activePalette) : activePalette;
    
    try {
      const style = pickRandomStyle();
      const complexity: Complexity = 'simple'; // 单张重新生成用简单模式
      
      // 生成AI图像
      let imageUrl: string;
      try {
        imageUrl = await generateAIImage(colors, randomTemplate.prompt, { style, complexity });
      } catch (error: any) {
        console.error(`重新生成图纸失败:`, error);
        setGeneratedPatterns(prev => prev.map(p => 
          p.id === patternId
            ? { ...p, isProcessing: false, name: `${p.name} (生成失败: ${error?.message || '未知错误'})` }
            : p
        ));
        return;
      }
      
      // 处理图像转拼豆
      const pattern = await processImageToPattern(
        imageUrl,
        randomTemplate.name,
        patternId,
        paletteWithBW,
        colors,
        { maxColors: 6, useAverageMode: false, gridSize } // 简单模式，最多6种颜色
      );
      
      // 更新图纸
      setGeneratedPatterns(prev => prev.map(p => (p.id === patternId ? pattern : p)));
    } catch (error: any) {
      console.error('重新生成图纸失败:', error);
      setGeneratedPatterns(prev => prev.map(p => 
        p.id === patternId
          ? { ...p, isProcessing: false, name: `${p.name} (生成失败: ${error?.message || '未知错误'})` }
          : p
      ));
    } finally {
      setIsGenerating(false);
    }
  }, [selectedColors, fullBeadPalette, getRandomTemplates, saveToHistory]);

  // 将参考图压缩/缩小，避免请求体过大导致「请求或响应数据过大」报错
  const MAX_REFERENCE_IMAGE_PX = 512;
  const compressReferenceImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        if (w <= MAX_REFERENCE_IMAGE_PX && h <= MAX_REFERENCE_IMAGE_PX) {
          resolve(dataUrl);
          return;
        }
        const scale = MAX_REFERENCE_IMAGE_PX / Math.max(w, h);
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  };

  // 处理参考图上传
  const handleReferenceImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageUrl = e.target?.result as string;
      try {
        const compressed = await compressReferenceImage(imageUrl);
        setReferenceImage(compressed);
      } catch {
        setReferenceImage(imageUrl);
      }
    };
    reader.onerror = () => {
      alert('读取文件失败');
    };
    reader.readAsDataURL(file);
  }, []);

  // 用描述与参考图生成一张图纸（描述和参考图都可选）
  const handleGenerateFromCustom = useCallback(async () => {
    const text = customPromptText.trim();
    const hasText = text.length > 0;
    const hasImage = referenceImage !== null;
    
    if (!hasText && !hasImage) {
      alert('请至少输入描述或上传参考图');
      return;
    }
    if (selectedColors.size === 0) {
      alert('请至少选择一个颜色');
      return;
    }
    // 保存当前状态到历史记录
    saveToHistory();
    // 用描述与参考图生成时，清空所有历史记录（包括AI生成的3套图纸）
    setGeneratedPatterns([]);
    
    const customId = nextCustomIdRef.current++;
    const customId2 = nextCustomIdRef.current++; // 无参考图时第二张（卡通）用
    const displayName = hasText 
      ? (text.length > 20 ? `自定义: ${text.slice(0, 20)}…` : `自定义: ${text}`)
      : '自定义: 参考图';
    const placeholder: GeneratedPattern = {
      id: customId,
      name: displayName,
      imageUrl: '',
      mappedData: null,
      gridDimensions: null,
      colorCounts: null,
      totalBeadCount: 0,
      isProcessing: true,
    };
    setGeneratedPatterns(prev => [...prev, placeholder]);
    setIsGeneratingCustom(true);

    const colors = autoIncludeBlackWhite ? ensureBlackWhiteInColorList(Array.from(selectedColors)) : Array.from(selectedColors);
    const activePalette = fullBeadPalette.filter(c => selectedColors.has(c.hex));
    const paletteWithBW = autoIncludeBlackWhite ? ensureBlackWhiteInPalette(activePalette) : activePalette;

    try {
      let imageUrl: string;
      
      if (hasImage && hasText) {
        // 有参考图+描述：用AI生成，以参考图为主，根据描述修改（颜色、色调、胖瘦、宽窄等）
        let promptForImage = text;
        try {
          console.log('正在解释用户输入:', text);
          const expandRes = await fetch('/api/expand-subject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: text }),
          });
          if (expandRes.ok) {
            const data = await expandRes.json();
            console.log('解释结果:', data);
            if (data.expanded && typeof data.expanded === 'string' && data.expanded.trim()) {
              promptForImage = data.expanded.trim();
              console.log('使用解释后的描述:', promptForImage);
            } else {
              console.warn('解释结果为空，使用原文:', text);
            }
          } else {
            const errorData = await expandRes.json().catch(() => ({}));
            console.warn('解释失败，使用原文:', text, '错误:', errorData);
          }
        } catch (e) {
          console.error('解释接口调用失败，使用原文:', text, e);
        }
        // 调用AI生成，传递参考图和描述
        imageUrl = await generateAIImage(colors, promptForImage, {
          style: 'cartoon',
          complexity: 'complex',
          referenceImage: referenceImage!, // 传递参考图
        });
      } else if (hasImage) {
        // 只有参考图：直接用参考图转拼豆
        imageUrl = referenceImage!;
      } else {
        // 只有描述：先尝试搜索参考图（针对非自然语言名词如"小八"），找不到再用AI生成
        // 注意：搜索功能可能不够可靠，如果失败会自动回退到AI生成
        let foundReferenceImage = false;
        const shouldTrySearch = text.length <= 20 && !text.includes('的') && !text.includes('和'); // 简单判断：短且不含描述性词汇
        if (shouldTrySearch) {
          try {
            console.log('尝试搜索参考图:', text);
            const searchRes = await fetch('/api/search-reference-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: text }),
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              console.log('搜索参考图结果:', searchData);
              if (searchData.found && searchData.imageUrl) {
                console.log('✅ 找到参考图，使用参考图转拼豆:', searchData.imageUrl.substring(0, 50));
                imageUrl = searchData.imageUrl;
                foundReferenceImage = true;
              } else {
                console.log('❌ 未找到参考图，将使用AI生成');
              }
            } else {
              const errorData = await searchRes.json().catch(() => ({}));
              console.warn('搜索参考图API返回错误，将使用AI生成:', errorData);
            }
          } catch (e) {
            console.warn('搜索参考图失败，将使用AI生成:', e);
          }
        } else {
          console.log('输入看起来像描述性文本，跳过搜索，直接使用AI生成');
        }
        
        if (!foundReferenceImage) {
          // 没找到参考图：无参考图时生成两张（写实 + 卡通），有参考图时不会进此分支
          let promptForImage = text;
          try {
            console.log('正在解释用户输入:', text);
            const expandRes = await fetch('/api/expand-subject', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: text }),
            });
            if (expandRes.ok) {
              const data = await expandRes.json();
              console.log('解释结果:', data);
              if (data.expanded && typeof data.expanded === 'string' && data.expanded.trim()) {
                promptForImage = data.expanded.trim();
                console.log('使用解释后的描述:', promptForImage);
              } else {
                console.warn('解释结果为空，使用原文:', text);
              }
            } else {
              const errorData = await expandRes.json().catch(() => ({}));
              console.warn('解释失败，使用原文:', text, '错误:', errorData);
            }
          } catch (e) {
            console.error('解释接口调用失败，使用原文:', text, e);
          }
          if (!hasImage) {
            // 无参考图：生成写实版 + 卡通版两张，先加第二个占位并重命名第一个
            setGeneratedPatterns(prev => [
              ...prev.map(p => (p.id === customId ? { ...p, name: displayName } : p)),
              {
                id: customId2,
                name: displayName,
                imageUrl: '',
                mappedData: null,
                gridDimensions: null,
                colorCounts: null,
                totalBeadCount: 0,
                isProcessing: true,
              },
            ]);
            const useAverageMode = false;
            try {
              const imageUrlRealistic = await generateAIImage(colors, promptForImage, {
                style: 'realistic',
                complexity: 'complex',
              });
              const patternRealistic = await processImageToPattern(
                imageUrlRealistic,
                displayName,
                customId,
                paletteWithBW,
                colors,
                { maxColors: 10, useAverageMode, gridSize }
              );
              const withPrompt1 = {
                ...patternRealistic,
                originalPrompt: text,
                originalReferenceImage: undefined as string | undefined,
              };
              setGeneratedPatterns(prev => prev.map(p => (p.id === customId ? withPrompt1 : p)));
            } catch (err: any) {
              setGeneratedPatterns(prev =>
                prev.map(p =>
                  p.id === customId ? { ...p, isProcessing: false, name: `${p.name} (生成失败: ${err?.message || '未知错误'})` } : p
                )
              );
            }
            try {
              const imageUrlCartoon = await generateAIImage(colors, promptForImage, {
                style: 'cartoon',
                complexity: 'complex',
              });
              const patternCartoon = await processImageToPattern(
                imageUrlCartoon,
                displayName,
                customId2,
                paletteWithBW,
                colors,
                { maxColors: 10, useAverageMode, gridSize }
              );
              const withPrompt2 = {
                ...patternCartoon,
                originalPrompt: text,
                originalReferenceImage: undefined as string | undefined,
              };
              setGeneratedPatterns(prev => prev.map(p => (p.id === customId2 ? withPrompt2 : p)));
            } catch (err: any) {
              setGeneratedPatterns(prev =>
                prev.map(p =>
                  p.id === customId2 ? { ...p, isProcessing: false, name: `${p.name} (生成失败: ${err?.message || '未知错误'})` } : p
                )
              );
            }
            setIsGeneratingCustom(false);
            return;
          }
          imageUrl = await generateAIImage(colors, promptForImage, {
            style: 'cartoon',
            complexity: 'complex',
          });
        }
      }
      
      // 有参考图时一律用平均色模式，尽量清晰、还原原图颜色；仅无参考图时用主导色
      const useAverageMode = hasImage;
      
      const pattern = await processImageToPattern(
        imageUrl!,
        displayName,
        customId,
        paletteWithBW,
        colors,
        { maxColors: 10, useAverageMode, gridSize }
      );
      // 存原始关键词和参考图（如果有），用于重新生成
      const patternWithPrompt = { 
        ...pattern, 
        originalPrompt: hasText ? text : (hasImage ? '' : undefined),
        originalReferenceImage: hasImage ? referenceImage! : undefined
      };
      setGeneratedPatterns(prev => prev.map(p => (p.id === customId ? patternWithPrompt : p)));
    } catch (error: any) {
      console.error('自定义描述生成失败:', error);
      setGeneratedPatterns(prev =>
        prev.map(p =>
          p.id === customId
            ? { ...p, isProcessing: false, name: `${p.name} (生成失败: ${error?.message || '未知错误'})` }
            : p
        )
      );
    } finally {
      setIsGeneratingCustom(false);
    }
  }, [customPromptText, referenceImage, selectedColors, fullBeadPalette]);

  // 重新生成自定义图纸（用同样的关键词和参考图，替换当前图纸）
  const handleRegenerateCustom = useCallback(async (originalPrompt: string, currentPatternId: number, originalReferenceImage?: string) => {
    if (selectedColors.size === 0) {
      alert('请至少选择一个颜色');
      return;
    }
    // 保存当前状态到历史记录
    saveToHistory();
    const displayName = originalPrompt.length > 20 ? `自定义: ${originalPrompt.slice(0, 20)}…` : `自定义: ${originalPrompt}`;
    const placeholder: GeneratedPattern = {
      id: currentPatternId,
      name: displayName,
      imageUrl: '',
      mappedData: null,
      gridDimensions: null,
      colorCounts: null,
      totalBeadCount: 0,
      isProcessing: true,
      originalPrompt,
      originalReferenceImage,
    };
    // 替换当前图纸，不追加
    setGeneratedPatterns(prev => prev.map(p => (p.id === currentPatternId ? placeholder : p)));
    setIsGeneratingCustom(true);

    const colors = autoIncludeBlackWhite ? ensureBlackWhiteInColorList(Array.from(selectedColors)) : Array.from(selectedColors);
    const activePalette = fullBeadPalette.filter(c => selectedColors.has(c.hex));
    const paletteWithBW = autoIncludeBlackWhite ? ensureBlackWhiteInPalette(activePalette) : activePalette;

    try {
      let imageUrl: string;
      const hasImage = !!originalReferenceImage;
      const hasText = !!originalPrompt;
      
      if (hasImage && hasText) {
        // 有参考图+描述：用AI生成，以参考图为主，根据描述修改
        let promptForImage = originalPrompt;
        try {
          const expandRes = await fetch('/api/expand-subject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: originalPrompt }),
          });
          if (expandRes.ok) {
            const { expanded } = await expandRes.json();
            if (expanded && typeof expanded === 'string' && expanded.trim()) {
              promptForImage = expanded.trim();
            }
          }
        } catch (_) {
          // 解释失败则直接用原文
        }
        imageUrl = await generateAIImage(colors, promptForImage, {
          style: 'cartoon',
          complexity: 'complex',
          referenceImage: originalReferenceImage, // 传递参考图
        });
      } else if (hasImage) {
        // 只有参考图：直接用参考图转拼豆
        imageUrl = originalReferenceImage!;
      } else {
        // 只有描述：用AI生成
        let promptForImage = originalPrompt;
        try {
          const expandRes = await fetch('/api/expand-subject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: originalPrompt }),
          });
          if (expandRes.ok) {
            const { expanded } = await expandRes.json();
            if (expanded && typeof expanded === 'string' && expanded.trim()) {
              promptForImage = expanded.trim();
            }
          }
        } catch (_) {
          // 解释失败则直接用原文
        }
        imageUrl = await generateAIImage(colors, promptForImage, {
          style: 'cartoon',
          complexity: 'complex',
        });
      }
      
      // 判断是否使用平均色模式
      const useAverageMode = hasImage; // 有参考图时用平均色，尽量还原原图颜色
      
      const pattern = await processImageToPattern(
        imageUrl,
        displayName,
        currentPatternId,
        paletteWithBW,
        colors,
        { maxColors: 10, useAverageMode, gridSize } // 重新生成：限制最多10种颜色
      );
      const patternWithPrompt = { 
        ...pattern, 
        originalPrompt,
        originalReferenceImage // 保存参考图，以便下次重新生成时使用
      };
      // 替换当前图纸
      setGeneratedPatterns(prev => prev.map(p => (p.id === currentPatternId ? patternWithPrompt : p)));
    } catch (error: any) {
      console.error('重新生成失败:', error);
      setGeneratedPatterns(prev =>
        prev.map(p =>
          p.id === currentPatternId
            ? { ...p, isProcessing: false, name: `${p.name} (生成失败: ${error?.message || '未知错误'})` }
            : p
        )
      );
    } finally {
      setIsGeneratingCustom(false);
    }
  }, [selectedColors, fullBeadPalette]);

  // 处理图片上传
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (selectedColors.size === 0) {
      alert('请先选择你多余的豆子颜色');
      return;
    }
    
    // 保存当前状态到历史记录
    saveToHistory();

    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }

    setIsProcessingUpload(true);
    setUploadedImage(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageUrl = e.target?.result as string;
      setUploadedImage(imageUrl);

      try {
        const colors = Array.from(selectedColors);
        const activePalette = fullBeadPalette.filter(c => selectedColors.has(c.hex));
        const paletteWithBW = autoIncludeBlackWhite ? ensureBlackWhiteInPalette(activePalette) : activePalette;

        // 上传图片：用当前选择的颜色还原图片，尽量贴近原图（平均色模式）
        const pattern = await processImageToPattern(
          imageUrl,
          '上传的图片',
          0,
          paletteWithBW,
          colors,
          { useAverageMode: true, gridSize }
        );

        // 替换生成的图纸列表
        setGeneratedPatterns([pattern]);
      } catch (error) {
        console.error('处理上传图片失败:', error);
        alert('处理图片失败，请重试');
      } finally {
        setIsProcessingUpload(false);
      }
    };

    reader.onerror = () => {
      alert('读取文件失败');
      setIsProcessingUpload(false);
    };

    reader.readAsDataURL(file);
  }, [selectedColors, fullBeadPalette]);

  // 打开下载设置弹窗（使用原仓库的下载逻辑）
  const handleDownload = useCallback((pattern: GeneratedPattern) => {
    if (!pattern.mappedData || !pattern.gridDimensions || !pattern.colorCounts) {
      alert('图纸数据未准备好，请稍候');
      return;
    }
    setDownloadModalPattern(pattern);
  }, []);

  // 执行下载（完全沿用原仓库 imageDownloader.downloadImage）
  const handleDownloadConfirm = useCallback((pattern: GeneratedPattern, opts?: GridDownloadOptions) => {
    if (!pattern.mappedData || !pattern.gridDimensions || !pattern.colorCounts) return;
    const options = opts ?? downloadOptions;
    const activeBeadPalette: PaletteColor[] = Object.keys(pattern.colorCounts).map(hex => ({
      key: hex,
      hex,
      rgb: hexToRgb(hex) ?? { r: 0, g: 0, b: 0 },
    }));
    downloadImage({
      mappedPixelData: pattern.mappedData,
      gridDimensions: pattern.gridDimensions,
      colorCounts: pattern.colorCounts,
      totalBeadCount: pattern.totalBeadCount,
      options,
      activeBeadPalette,
      selectedColorSystem: colorSystem,
    });
    setDownloadModalPattern(null);
  }, [downloadOptions, colorSystem]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            消耗多余豆子
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            选择你多余的豆子颜色，AI会生成卡通拼豆图纸，或输入描述/上传参考图生成拼豆图纸
          </p>
        </div>

        {/* 撤销按钮 */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 dark:disabled:text-gray-500 transition-colors flex items-center gap-2"
            title={history.length === 0 ? '没有可撤销的操作' : `撤销上一步操作（还有 ${history.length} 步可撤销）`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            撤销
            {history.length > 0 && (
              <span className="text-xs bg-white/20 dark:bg-white/20 px-1.5 py-0.5 rounded">
                {history.length}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：颜色选择和上传 */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">选择你多余的豆子颜色</h2>
            
            {/* 色号系统选择 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">色号系统：</label>
              <select
                value={colorSystem}
                onChange={(e) => setColorSystem(e.target.value as ColorSystem)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                {colorSystemOptions.map(option => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 颜色预设：一键应用 / 保存当前 / 更新 / 删除 */}
            <div className="mb-4 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">颜色预设</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">保存当前选择，下次一键应用；应用后还可再调整并更新该预设。</p>
              {colorPresets.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {colorPresets.map((preset) => (
                    <li key={preset.id} className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate min-w-0">
                        {preset.name}（{preset.colorHexes.length} 色）
                      </span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                          应用
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePreset(preset)}
                          className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded"
                        >
                          更新
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePreset(preset)}
                          className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded"
                        >
                          删除
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={saveCurrentAsPreset}
              className="w-full mb-4 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
            >
              保存当前选择为新的预设
            </button>

            {/* 颜色选择器 */}
            <ColorPaletteSelector
              palette={fullBeadPalette}
              selectedColors={selectedColors}
              colorSystem={colorSystem}
              onColorToggle={handleColorToggle}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
            />

            {/* 已选颜色统计 */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm">
                已选择 <span className="font-bold text-blue-600 dark:text-blue-400">{selectedColors.size}</span> 种颜色
              </p>
            </div>

            {/* 图纸尺寸选择 */}
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">图纸尺寸</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { size: 29, label: '小号', desc: '29×29 · ~14.5cm' },
                  { size: 50, label: '中号', desc: '50×50 · ~25cm' },
                  { size: 70, label: '大号', desc: '70×70 · ~35cm' },
                  { size: 100, label: '超大', desc: '100×100 · ~50cm' },
                ].map(opt => (
                  <button
                    key={opt.size}
                    onClick={() => setGridSize(opt.size)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                      gridSize === opt.size
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-xs opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI生成随机图纸（3套） */}
            <button
              onClick={handleGenerate}
              disabled={selectedColors.size === 0 || isGenerating || isGeneratingCustom}
              className="w-full mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
            >
              {isGenerating ? '生成中...' : 'AI生成随机图纸（3套）'}
            </button>


            {/* 用描述与参考图生成一张（描述和参考图都可选） */}
            <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="block text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                用描述与参考图生成一张
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                输入描述或上传参考图，或两者都提供。（如果要生成特定角色比如chiikawa小八、灰太狼等，建议上传参考图）例如：小恐龙、草莓蛋糕
              </p>
              <input
                type="text"
                value={customPromptText}
                onChange={e => setCustomPromptText(e.target.value)}
                placeholder="描述（可选）"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                disabled={isGenerating || isGeneratingCustom}
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleReferenceImageUpload}
                ref={referenceImageInputRef}
                className="hidden"
              />
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => referenceImageInputRef.current?.click()}
                  disabled={isGenerating || isGeneratingCustom}
                  className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
                >
                  {referenceImage ? '更换参考图' : '上传参考图（可选）'}
                </button>
                {referenceImage && (
                  <button
                    onClick={() => {
                      setReferenceImage(null);
                      if (referenceImageInputRef.current) referenceImageInputRef.current.value = '';
                    }}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                  >
                    清除
                  </button>
                )}
              </div>
              {referenceImage && (
                <div className="mb-2">
                  <img src={referenceImage} alt="参考图" className="w-full h-32 object-contain rounded border border-gray-300 dark:border-gray-600" />
                </div>
              )}
              <button
                onClick={handleGenerateFromCustom}
                disabled={selectedColors.size === 0 || isGenerating || isGeneratingCustom || (!customPromptText.trim() && !referenceImage)}
                className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {isGeneratingCustom ? '生成中...' : '生成'}
              </button>
            </div>

            {/* API配置提示 */}
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                <strong>提示：</strong>AI生成需要配置API Key。
                <br />
                查看 <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">API_CONFIG.md</code> 了解配置方法。
                <br />
                <span className="text-yellow-600 dark:text-yellow-400">上传图片功能无需API Key。</span>
              </p>
            </div>
          </div>

          {/* 右侧：生成的图纸列表 */}
          <div className="lg:col-span-2">
            {isGenerating && generatedPatterns.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">正在生成图纸...</p>
              </div>
            )}

            {!isGenerating && generatedPatterns.length === 0 && !isProcessingUpload && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400">选择颜色后点击"AI生成图纸"或上传图片</p>
              </div>
            )}

            {isProcessingUpload && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">正在处理上传的图片...</p>
              </div>
            )}

            {generatedPatterns.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  生成的图纸 ({generatedPatterns.filter(p => !p.isProcessing).length}/{generatedPatterns.length})
                </h2>
                {generatedPatterns.map((pattern) => (
                  <PatternCard
                    key={pattern.id}
                    pattern={pattern}
                    colorSystem={colorSystem}
                    onDownload={() => handleDownload(pattern)}
                    onRegenerate={pattern.originalPrompt !== undefined ? (prompt, id) => handleRegenerateCustom(prompt, id, pattern.originalReferenceImage) : undefined}
                    onRegenerateSingle={pattern.originalPrompt === undefined ? handleRegenerateSinglePattern : undefined}
                    onEdit={() => setEditingPatternId(pattern.id)}
                    isGeneratingCustom={isGeneratingCustom}
                    isGenerating={isGenerating}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 原仓库：下载图纸设置弹窗 + 使用 imageDownloader 输出 */}
      {downloadModalPattern && (
        <DownloadSettingsModal
          isOpen={!!downloadModalPattern}
          onClose={() => setDownloadModalPattern(null)}
          options={downloadOptions}
          onOptionsChange={setDownloadOptions}
          onDownload={(opts) => handleDownloadConfirm(downloadModalPattern, opts)}
        />
      )}

      {/* 图纸编辑弹窗 */}
      {editingPatternId !== null && (() => {
        const editingPattern = generatedPatterns.find(p => p.id === editingPatternId);
        if (!editingPattern || !editingPattern.mappedData) return null;
        
        const activePalette = fullBeadPalette.filter(c => selectedColors.has(c.hex));
        
        return (
          <PatternEditor
            pattern={editingPattern}
            colorSystem={colorSystem}
            activePalette={activePalette}
            onSave={(updated) => {
              setGeneratedPatterns(prev => prev.map(p => 
                p.id === editingPatternId
                  ? { ...p, ...updated }
                  : p
              ));
              // 保存后不自动关闭，需要用户手动点击关闭按钮
            }}
            onClose={() => setEditingPatternId(null)}
            hideFloatingToolbar
          />
        );
      })()}
    </div>
  );
}

// 图纸卡片组件：只显示一张带网格的图纸（与原项目最终输出一致）
function PatternCard({ 
  pattern, 
  colorSystem, 
  onDownload,
  onRegenerate,
  onRegenerateSingle,
  onEdit,
  isGeneratingCustom,
  isGenerating
}: { 
  pattern: GeneratedPattern; 
  colorSystem: ColorSystem;
  onDownload: () => void;
  onRegenerate?: (originalPrompt: string, patternId: number, originalReferenceImage?: string) => void;
  onRegenerateSingle?: (patternId: number) => void;
  onEdit?: () => void;
  isGeneratingCustom?: boolean;
  isGenerating?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [redrawCount, setRedrawCount] = React.useState(0);

  // 监听页面可见性变化，确保移动端滚动回来后重绘
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setRedrawCount(prev => prev + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 使用 IntersectionObserver 检测 canvas 进入可视区域时重绘
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRedrawCount(prev => prev + 1);
          }
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!canvasRef.current || !pattern.mappedData || !pattern.gridDimensions) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { N, M } = pattern.gridDimensions;
    const cellSize = 10;
    canvas.width = N * cellSize;
    canvas.height = M * cellSize;

    // 绘制图案色块
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const cell = pattern.mappedData[j][i];
        const x = i * cellSize;
        const y = j * cellSize;
        if (cell && !cell.isExternal) {
          ctx.fillStyle = cell.color;
          ctx.fillRect(x, y, cellSize, cellSize);
        }
        // 网格线（与原项目图纸一致）
        ctx.strokeStyle = '#DDDDDD';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellSize, cellSize);
      }
    }
  }, [pattern, redrawCount]);

  if (pattern.isProcessing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {pattern.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">正在生成...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* 图纸（带网格，仅此一张） */}
        <div className="flex-shrink-0">
          {pattern.mappedData && pattern.gridDimensions && (
            <canvas
              ref={canvasRef}
              className="border border-gray-300 dark:border-gray-600 rounded"
              style={{ maxWidth: '100%', height: 'auto' }}
              title={`${pattern.name} · ${pattern.gridDimensions.N}×${pattern.gridDimensions.M} 格`}
            />
          )}
        </div>

        {/* 信息 */}
        <div className="flex-1">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            {pattern.name}
          </h3>
          
          {pattern.gridDimensions && (
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                尺寸：{pattern.gridDimensions.N} × {pattern.gridDimensions.M} 格
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                总豆数：{pattern.totalBeadCount} 粒
              </p>
              {pattern.colorCounts && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  使用颜色：{Object.keys(pattern.colorCounts).length} 种
                </p>
              )}
            </div>
          )}

          {/* 颜色统计 */}
          {pattern.colorCounts && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">颜色统计：</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(pattern.colorCounts)
                  .sort((a, b) => b[1].count - a[1].count)
                  .slice(0, 8)
                  .map(([key, data]) => (
                    <div
                      key={key}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                      title={`${getDisplayColorKey(data.color, colorSystem)}: ${data.count}粒`}
                    >
                      <div
                        className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: data.color }}
                      />
                      <span className="text-gray-700 dark:text-gray-300">
                        {getDisplayColorKey(data.color, colorSystem)}: {data.count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 下载按钮 */}
          {pattern.mappedData && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onDownload}
                  className="flex-1 md:flex-none px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                >
                  下载图纸
                </button>
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="flex-1 md:flex-none px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    编辑
                  </button>
                )}
              </div>
              {/* 自定义生成的图纸：显示「重新生成」按钮，基于提示词和参考图重新生成 */}
              {/* 判断条件：originalPrompt !== undefined 表示是自定义生成的（包括只有参考图的情况） */}
              {(pattern.originalPrompt !== undefined) && onRegenerate && (
                <button
                  onClick={() => onRegenerate(pattern.originalPrompt || '', pattern.id, pattern.originalReferenceImage)}
                  disabled={isGeneratingCustom}
                  className="w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {isGeneratingCustom ? '生成中...' : '重新生成'}
                </button>
              )}
              {/* AI随机生成的图纸：显示「换一张」按钮，随机生成 */}
              {(pattern.originalPrompt === undefined) && onRegenerateSingle && (
                <button
                  onClick={() => onRegenerateSingle(pattern.id)}
                  disabled={isGenerating || isGeneratingCustom}
                  className="w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {isGenerating ? '生成中...' : '换一张'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 风格与复杂度（随机用）
type Style = 'realistic' | 'cartoon';
type Complexity = 'simple' | 'complex';

// AI图像生成（随机风格 + 主题 + 复杂度：简单时让 AI 根据主题从列表中选少量合适颜色）
async function generateAIImage(
  colors: string[],
  basePrompt: string,
  options: { style: Style; complexity: Complexity; referenceImage?: string } = { style: 'realistic', complexity: 'simple' }
): Promise<string> {
  const { style, complexity, referenceImage } = options;
  const styleText = style === 'realistic' ? STYLE_REALISTIC : STYLE_CARTOON;
  const colorList = colors.slice(0, 24).join(', ');
  const colorHint =
    complexity === 'simple'
      ? `Available colors (choose only 3–6 that best fit the subject): ${colorList}. Pick the most suitable colors for this image and use only those. Keep the design simple and minimal.`
      : `Use a moderate number of these colors (e.g. 6–10, not too many): ${colorList}. Keep the color palette limited and clean. Avoid using too many different colors—use fewer colors with clear distinction.`;
  
  // 判断是否需要让图案占满画面：描述复杂（长度>50或包含多个词）或颜色选择多（>12种）
  const isComplexDescription = basePrompt.length > 50 || basePrompt.split(/[\s,，、]+/).length > 3;
  const hasManyColors = colors.length > 12;
  const shouldFillFrame = isComplexDescription || hasManyColors;
  
  const sizeHint = shouldFillFrame
    ? `Make the subject large and fill most of the frame (80-90% of the image). Minimize empty space around the subject. `
    : '';
  
  // 自定义生成时（卡通风格），使用更简洁直接的prompt
  const isCustomGeneration = style === 'cartoon' && complexity === 'complex';
  
  // 如果有参考图，构建包含参考图的prompt
  let fullPrompt: string;
  if (referenceImage) {
    // 有参考图+描述：以参考图为主，尽量清晰、还原原图颜色，描述仅做微调
    fullPrompt = `Generate exactly one image. Do not ask questions or reply with text—output only the image. ` +
      `${styleText} ` +
      `Use the provided reference image as the base. Keep the main structure, pose, and character design from the reference image. ` +
      `Preserve the original colors of the reference image as much as possible—output should be clear and color-accurate to the reference. ` +
      `Only apply the following modifications from the description where relevant: ${basePrompt}. ` +
      `If the description mentions specific changes to colors or style, apply those subtly while keeping the reference's colors and clarity. ` +
      `${colorHint} ` +
      `${sizeHint}` +
      `Make the image sharp, clear, and suitable for perler bead art. Do NOT add any border, frame, or colored outline. No confetti, no scattered dots.`;
  } else if (isCustomGeneration) {
    fullPrompt = `Generate exactly one image. Do not ask questions or reply with text—output only the image. ` +
      `${styleText} ` +
      `Draw: ${basePrompt}. ` +
      `${colorHint} ` +
      `${sizeHint}` +
      `Make it very cute, recognizable, and suitable for perler bead art. Do NOT add any border, frame, or colored outline around the image. No confetti, no scattered dots.`;
  } else {
    fullPrompt = `Generate exactly one image. Do not ask questions or reply with text—output only the image. ` +
      `Reference: one clear, iconic image of the subject (like a clean character reference or sticker). ` +
      `${styleText} Subject: ${basePrompt}. ${colorHint} ` +
      `${sizeHint}` +
      `Use high contrast colors and clear edges between color areas. Do NOT add any border, frame, or outline around the image—no blue or colored rim. ` +
      `No confetti, no scattered beads or dots around the figure.`;
  }

  console.log('调用图像生成API，提示词:', fullPrompt.substring(0, 100));
  console.log('是否有参考图:', !!referenceImage);

  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        colors: colors,
        referenceImage: referenceImage, // 传递参考图（base64或URL）
      }),
    });

    if (!response.ok) {
      const statusFallback = `HTTP ${response.status}: ${response.statusText}`;
      let errorMessage = statusFallback;
      try {
        const text = await response.text();
        if (text && text.trim()) {
          const error = JSON.parse(text);
          errorMessage = error.error || error.message || statusFallback;
          if (error.error && error.message && error.error !== error.message) {
            const msg = error.message as string;
            if (!msg.startsWith(error.error)) {
              errorMessage = `${error.error}: ${msg}`;
            } else {
              errorMessage = msg;
            }
          }
        }
        console.error('API错误响应:', response.status, response.statusText, text?.substring(0, 200) || '(空响应体)');
      } catch (e) {
        console.error('解析错误响应失败:', e);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('API成功响应，图像URL长度:', data.imageUrl?.length || 0);
    return data.imageUrl;
  } catch (error: any) {
    console.error('fetch错误:', error);
    // 如果是网络错误，提供更友好的错误信息
    if (error.message === 'Failed to fetch' || error.name === 'TypeError' || error.message?.includes('fetch failed')) {
      throw new Error('网络连接失败: 无法连接到图像生成服务，请检查网络连接或稍后重试');
    }
    // 如果错误信息已经包含"网络连接失败"，直接抛出
    if (error.message?.includes('网络连接失败')) {
      throw error;
    }
    throw error;
  }
}

// 简单模式：将图纸颜色数压到最多 maxColors 种（取用量最多的几种，其余格按最近色归并）
function reduceMappedDataToMaxColors(
  mappedData: MappedPixel[][],
  N: number,
  M: number,
  colorCounts: { [key: string]: { count: number; color: string } },
  maxColors: number
): { mappedData: MappedPixel[][]; colorCounts: { [key: string]: { count: number; color: string } } } {
  const entries = Object.entries(colorCounts).sort((a, b) => b[1].count - a[1].count);
  const topHexes = entries.slice(0, maxColors).map(([hex]) => hex);
  const topPalette: PaletteColor[] = topHexes.map(hex => {
    const rgb = hexToRgb(hex);
    return { key: hex, hex, rgb: rgb ?? { r: 0, g: 0, b: 0 } };
  });
  const newData = mappedData.map(row =>
    row.map(cell => {
      if (!cell || cell.isExternal || !cell.color) return cell;
      const closest = findClosestPaletteColor(hexToRgb(cell.color) ?? { r: 0, g: 0, b: 0 }, topPalette);
      return { ...cell, key: closest.key, color: closest.hex };
    })
  );
  const newCounts: { [key: string]: { count: number; color: string } } = {};
  newData.flat().forEach(cell => {
    if (cell && !cell.isExternal && cell.color) {
      const hex = cell.color.toUpperCase();
      if (!newCounts[hex]) newCounts[hex] = { count: 0, color: hex };
      newCounts[hex].count++;
    }
  });
  return { mappedData: newData, colorCounts: newCounts };
}

// 处理图像转换为拼豆图纸
// maxColors：简单模式传 6，将图纸压到最多 6 种颜色；不传则不限
async function processImageToPattern(
  imageUrl: string,
  name: string,
  id: number,
  palette: PaletteColor[],
  selectedColors: string[],
  options?: { useAverageMode?: boolean; maxColors?: number; gridSize?: number }
): Promise<GeneratedPattern> {
  const maxColors = options?.maxColors;
  const gridSize = options?.gridSize || 50;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // 将原图统一缩放到固定尺寸，确保每次采样质量一致
        const STANDARD_SIZE = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = STANDARD_SIZE;
        canvas.height = STANDARD_SIZE;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('无法创建canvas上下文'));
          return;
        }

        // 等比缩放绘制到 1024×1024，居中填充
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, STANDARD_SIZE, STANDARD_SIZE);

        // 正方形网格，尺寸由用户选择
        const N = gridSize;
        const M = gridSize;

        // AI生成和上传图片都用平均色模式（更平滑、更写实），每个格子取区域平均再映射到调色板
        const t1FallbackColor = palette.find(p => p.hex.toUpperCase() === '#FFFFFF') || palette[0];
        let mappedData = calculatePixelGrid(
          ctx,
          STANDARD_SIZE,
          STANDARD_SIZE,
          N,
          M,
          palette,
          PixelationMode.Average, // 统一用 Average 模式，更平滑写实
          t1FallbackColor
        );
        // 检查是否是自定义生成（通过 name 判断）
        const isCustomGeneration = name.startsWith('自定义:');
        
        if (isCustomGeneration) {
          // 自定义生成的图纸：先找主体（最大连通块），再只把主体外的标成背景，这样主体内的白色（如小羊头上的毛）会保留
          // 1. 统计边框上出现最多的颜色，视为背景色
          const borderColors: string[] = [];
          for (let i = 0; i < N; i++) {
            if (mappedData[0]?.[i]?.color) borderColors.push(mappedData[0][i].color);
            if (M > 1 && mappedData[M - 1]?.[i]?.color) borderColors.push(mappedData[M - 1][i].color);
          }
          for (let j = 0; j < M; j++) {
            if (mappedData[j]?.[0]?.color) borderColors.push(mappedData[j][0].color);
            if (N > 1 && mappedData[j]?.[N - 1]?.color) borderColors.push(mappedData[j][N - 1].color);
          }
          let backgroundColor: string | null = null;
          if (borderColors.length > 0) {
            const count: Record<string, number> = {};
            borderColors.forEach(c => { count[c] = (count[c] || 0) + 1; });
            backgroundColor = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
          }

          // 1.5 检测并清除最外两圈的蓝色边框（AI 常画蓝边）
          const isBlue = (hex: string) => {
            const h = (hex || '').toUpperCase().replace('#', '');
            if (h.length !== 6) return false;
            const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
            return b >= 200 && r <= 80 && g <= 80;
          };
          // 清除外圈 2 层的蓝色像素
          for (let layer = 0; layer < 2; layer++) {
            for (let i = layer; i < N - layer; i++) {
              if (mappedData[layer]?.[i]?.color && isBlue(mappedData[layer][i].color)) {
                mappedData[layer][i] = { ...transparentColorData };
              }
              if (M > 1 && mappedData[M - 1 - layer]?.[i]?.color && isBlue(mappedData[M - 1 - layer][i].color)) {
                mappedData[M - 1 - layer][i] = { ...transparentColorData };
              }
            }
            for (let j = layer; j < M - layer; j++) {
              if (mappedData[j]?.[layer]?.color && isBlue(mappedData[j][layer].color)) {
                mappedData[j][layer] = { ...transparentColorData };
              }
              if (N > 1 && mappedData[j]?.[N - 1 - layer]?.color && isBlue(mappedData[j][N - 1 - layer].color)) {
                mappedData[j][N - 1 - layer] = { ...transparentColorData };
              }
            }
          }

          // 2. 4 连通 flood-fill：从边框出发，用颜色距离阈值将相似背景色标记为 external
          // 使用 4 连通（不穿过对角缝隙），避免泄漏到主体内部
          const BG_DIST_THRESHOLD = 3600; // RGB 各差 ~35 以内
          const originalBeforeFlood = mappedData.map(row => row.map(cell => ({ ...cell })));
          if (backgroundColor) {
            const isBgColor = (hex: string) =>
              hex.toUpperCase() === backgroundColor!.toUpperCase() ||
              hexColorDistanceSq(hex, backgroundColor!) < BG_DIST_THRESHOLD;

            const visited = Array(M).fill(null).map(() => Array(N).fill(false));
            const stack: { r: number; c: number }[] = [];
            for (let i = 0; i < N; i++) {
              if (mappedData[0]?.[i]?.color && isBgColor(mappedData[0][i].color)) stack.push({ r: 0, c: i });
              if (M > 1 && mappedData[M - 1]?.[i]?.color && isBgColor(mappedData[M - 1][i].color)) stack.push({ r: M - 1, c: i });
            }
            for (let j = 0; j < M; j++) {
              if (mappedData[j]?.[0]?.color && isBgColor(mappedData[j][0].color)) stack.push({ r: j, c: 0 });
              if (N > 1 && mappedData[j]?.[N - 1]?.color && isBgColor(mappedData[j][N - 1].color)) stack.push({ r: j, c: N - 1 });
            }
            while (stack.length > 0) {
              const { r, c } = stack.pop()!;
              if (r < 0 || r >= M || c < 0 || c >= N || visited[r][c]) continue;
              const cell = mappedData[r]?.[c];
              if (!cell?.color || cell.isExternal) { visited[r][c] = true; continue; }
              if (!isBgColor(cell.color)) continue;
              visited[r][c] = true;
              mappedData[r][c] = { ...transparentColorData };
              // 4 连通：仅上下左右
              stack.push({ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 });
            }
          }

          // 3. 封边验证：恢复被误标为背景的内部像素
          mappedData = sealInteriorLeaks(mappedData, originalBeforeFlood, N, M);

          // 4. 去掉孤立豆子（8 连通），只保留与主体连通的区域
          mappedData = removeIsolatedPixels(mappedData, N, M);
        } else {
          // AI随机生成的图纸：标记背景为 external（不填色）
          mappedData = markBackgroundAsExternal(mappedData, N, M);
          // 边缘密封：去掉孤立豆子，只保留与主体连通的区域
          mappedData = removeIsolatedPixels(mappedData, N, M);
        }

        // 统计颜色
        let colorCounts: { [key: string]: { count: number; color: string } } = {};
        mappedData.flat().forEach(cell => {
          if (cell && !cell.isExternal && cell.color) {
            const hex = cell.color.toUpperCase();
            if (!colorCounts[hex]) {
              colorCounts[hex] = { count: 0, color: hex };
            }
            colorCounts[hex].count++;
          }
        });

        // 简单模式：压到最多 maxColors 种颜色（取用量最多的几种，其余按最近色归并）
        if (maxColors != null && Object.keys(colorCounts).length > maxColors) {
          const reduced = reduceMappedDataToMaxColors(mappedData, N, M, colorCounts, maxColors);
          mappedData = reduced.mappedData;
          colorCounts = reduced.colorCounts;
        }

        const totalBeadCount = Object.values(colorCounts).reduce((sum, item) => sum + item.count, 0);

        resolve({
          id,
          name,
          imageUrl,
          mappedData,
          gridDimensions: { N, M },
          colorCounts,
          totalBeadCount,
          isProcessing: false
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('图像加载失败'));
    };

    img.src = imageUrl;
  });
}

