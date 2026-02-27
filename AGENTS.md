# AGENTS.md - Coding Agent Guidelines

## Project Overview

Perler Beads Pattern Generator (拼豆图纸生成器) - A Next.js application that converts images into pixelated patterns for perler bead crafting. Features include AI-powered image generation, intelligent color mapping, and progress tracking.

## Tech Stack

- **Framework**: Next.js 15 + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 4
- **Image Processing**: Browser Canvas API
- **PWA**: Serwist for service worker
- **Package Manager**: npm

## Build Commands

```bash
# Development server (port 3000)
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

**Note**: No test framework is currently configured. When adding tests, consider Vitest or Jest.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (image generation, proxy)
│   ├── consume-beads/     # Main feature page
│   ├── focus/             # Focus mode for crafting
│   └── colorSystemMapping.json  # Color palette data
├── components/            # React components
│   ├── ConsumeBeads/     # Feature-specific components
│   └── *.tsx             # Shared components
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
    ├── pixelation.ts     # Core pixelation algorithms
    ├── colorSystemUtils.ts  # Color mapping utilities
    └── pixelEditingUtils.ts # Editing operations
```

## Code Style Guidelines

### Imports Order

1. React imports
2. Next.js imports
3. Third-party libraries
4. Local utilities (utils/)
5. Local components
6. Local types

```typescript
// Good example
import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MappedPixel } from '../utils/pixelation';
import ColorPalette from '../components/ColorPalette';
import { DownloadOptions } from '../types/downloadTypes';
```

### Client Components

Always use `'use client'` directive at the top of client-side components:

```typescript
'use client';

import React, { useState } from 'react';
// ...
```

### TypeScript

- **Strict mode is enabled** - avoid `any`, use proper types
- Define interfaces at the top of files before functions
- Use `type` for simple type aliases, `interface` for object shapes
- Export types and interfaces that may be reused

```typescript
// Type definitions at top
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type ColorSystem = 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝';
```

### React Patterns

- Use `useCallback` for event handlers to prevent unnecessary re-renders
- Destructure props in function parameters
- Custom hooks should start with `use` prefix
- Return objects from hooks for named exports

```typescript
// Hook pattern
export function useManualEditingState() {
  const [state, setState] = useState(initialState);
  
  const handler = useCallback(() => {
    // ...
  }, [dependencies]);
  
  return {
    state,
    handler,
  };
}
```

### Component Structure

```typescript
// 1. 'use client' directive (if needed)
'use client';

// 2. Imports
import React, { useState, useCallback } from 'react';

// 3. Type definitions
interface ComponentProps {
  title: string;
  onAction: () => void;
}

// 4. Component
const Component: React.FC<ComponentProps> = ({ title, onAction }) => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  
  // Handlers
  const handleClick = useCallback(() => {
    setIsOpen(true);
    onAction();
  }, [onAction]);
  
  // Render
  return (
    <div className="...">
      {/* content */}
    </div>
  );
};

export default Component;
```

### Naming Conventions

- **Components**: PascalCase (`ColorPalette.tsx`, `FloatingToolbar.tsx`)
- **Utilities**: camelCase (`pixelation.ts`, `colorSystemUtils.ts`)
- **Hooks**: camelCase with `use` prefix (`useManualEditingState.ts`)
- **Types**: PascalCase (`RgbColor`, `MappedPixel`)
- **Constants**: SCREAMING_SNAKE_CASE (`TRANSPARENT_KEY`)

### Styling

- Use Tailwind CSS utility classes
- Group classes logically: layout → sizing → spacing → visual → states
- Use CSS variables for theming (defined in `globals.css`)

```typescript
// Tailwind class organization
<div className="flex flex-col items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-lg shadow-md hover:shadow-lg transition-shadow">
```

### Comments

- Use Chinese (中文) for comments as per project convention
- Add JSDoc comments for public functions and complex logic

```typescript
/**
 * 计算两个颜色之间的欧氏距离
 * @param rgb1 第一个RGB颜色
 * @param rgb2 第二个RGB颜色
 * @returns 颜色距离值
 */
export function colorDistance(rgb1: RgbColor, rgb2: RgbColor): number {
  // ...
}
```

### Error Handling

- Use try-catch in async functions
- Provide meaningful error messages in Chinese for user-facing errors
- Log errors with context for debugging

```typescript
try {
  const result = await processData(data);
  return result;
} catch (error) {
  console.error('处理数据失败:', error);
  throw new Error('处理失败，请重试');
}
```

### API Routes

- Export async POST/GET functions
- Use `NextRequest` and `NextResponse` from `next/server`
- Return JSON responses with appropriate status codes

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Process request
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { error: '请求失败' },
      { status: 500 }
    );
  }
}
```

## Key Algorithms

### Pixelation (src/utils/pixelation.ts)

- **Dominant Mode**: Uses most frequent color in each cell (cartoon style)
- **Average Mode**: Uses average color in each cell (realistic style)
- Color mapping uses Euclidean distance in RGB space

### Color System (src/utils/colorSystemUtils.ts)

- Supports 5 color systems: MARD, COCO, 漫漫, 盼盼, 咪小窝
- All mappings defined in `colorSystemMapping.json`
- Hex value is the universal key across systems

### Flood Fill (src/utils/floodFillUtils.ts)

- Used for background removal and fill operations
- BFS-based algorithm for connected region detection

## Environment Variables

Required for AI image generation (optional for other features):

```bash
# AI Service (choose one)
GOOGLE_API_KEY=your_key        # Gemini
OPENAI_API_KEY=your_key        # DALL-E
AZURE_OPENAI_API_KEY=your_key  # Azure OpenAI
STABLE_DIFFUSION_API_KEY=your_key

# Proxy (optional)
HTTPS_PROXY=http://host:port
```

## Common Tasks

### Adding a new page

1. Create directory in `src/app/`
2. Add `page.tsx` file
3. Use `'use client'` if client-side interactivity needed

### Adding a new component

1. Create file in `src/components/`
2. Follow component structure above
3. Export as default

### Adding a new API route

1. Create directory in `src/app/api/`
2. Add `route.ts` file
3. Export async GET/POST/etc functions

## Important Notes

- The main entry page (`src/app/page.tsx`) redirects to `/consume-beads`
- Original homepage logic is preserved in `OriginalHomePage` function
- PWA is disabled in development, enabled in production
- Use `console.log` for debugging (removed in production build)
