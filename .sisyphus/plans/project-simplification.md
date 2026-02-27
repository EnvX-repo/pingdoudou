# 项目简化工作计划

## TL;DR

> **Quick Summary**: 最大幅度简化项目，删除所有未使用的文件、PWA 功能、调试页面和文档文件
> 
> **Deliverables**:
> - 删除约 40 个文件
> - 移除 PWA 功能
> - 清理 ~3200 行代码
> - 更新配置文件
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 6 waves
> **Critical Path**: Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5 → Wave 6 → Verification

---

## Context

### Original Request
最大幅度简化这个项目，删除所有没有用的文件

### Interview Summary
**Key Discussions**:
- 删除 OriginalHomePage 代码（~2000行）
- 删除调试/测试页面（test-api, pwa-debug）
- 完全移除 PWA 功能
- 删除根目录所有文档文件（只保留 README.md）

**Research Findings**:
- 项目当前有 50 个 src/ 文件
- 完成了完整的依赖关系分析
- 所有 npm 依赖都在使用中（无冗余依赖）
- 确认了 PWA 功能可以完全移除

### Metis Review
**Identified Gaps** (addressed):
- 遗漏了 `server.js`, `scripts/` 目录
- PWA 应该完全移除而不仅仅是离线页面
- 需要更新配置文件（next.config.ts, package.json, layout.tsx）

---

## Work Objectives

### Core Objective
删除所有未使用的代码和文件，保持项目功能完整

### Concrete Deliverables
- 删除约 40 个文件
- 移除 PWA 功能及相关配置
- 清理 OriginalHomePage 代码
- 更新配置文件

### Definition of Done
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无错误
- [ ] 项目功能完整可运行

### Must Have
- 保持核心功能（consume-beads, focus 页面）正常工作
- 保持 API 路由正常工作

### Must NOT Have (Guardrails)
- 不要删除被使用的组件或工具
- 不要破坏现有功能
- 不要删除 README.md

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **Framework**: N/A
- **Agent-Executed QA**: `npm run build` + `npm run lint`

### QA Policy
每个 wave 完成后运行 `npm run build` 验证无编译错误。

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 删除无引用文件):
├── Task 1: 删除 7 个无引用的组件/工具文件 [quick]
└── Task 2: 删除 2 个调试/测试页面 [quick]

Wave 2 (After Wave 1 — PWA 完全移除):
├── Task 3: 删除 PWA 相关文件 [quick]
├── Task 4: 更新 next.config.ts [quick]
├── Task 5: 更新 package.json [quick]
└── Task 6: 更新 layout.tsx [quick]

Wave 3 (After Wave 2 — OriginalHomePage 清理):
├── Task 7: 编辑 page.tsx 删除 OriginalHomePage [quick]
└── Task 8: 删除 3 个相关组件 [quick]

Wave 4 (After Wave 3 — 清理其他文件):
├── Task 9: 删除 11 个根目录文档文件 [quick]
└── Task 10: 删除 server.js + scripts/ [quick]

Wave 5 (After Wave 4 — 更新文档):
└── Task 11: 更新 AGENTS.md [quick]

Wave FINAL (After ALL tasks — verification):
├── Task F1: 构建验证 [quick]
└── Task F2: 功能验证 [quick]
```

### Agent Dispatch Summary
- **All tasks**: `quick` category - simple file deletion and edits
- **Total files to delete**: ~40
- **Total code to remove**: ~3200 lines

---

## TODOs

- [x] 1. 删除无引用的组件/工具文件

  **What to do**:
  删除以下 7 个文件：
  ```
  src/utils/canvasUtils.ts
  src/components/ColorPalette.tsx
  src/components/GridTooltip.tsx
  src/components/MagnifierTool.tsx
  src/components/MagnifierSelectionOverlay.tsx
  src/components/ConsumeBeads/ImageGenerationOptions.tsx
  src/components/ConsumeBeads/GeneratedPatternPreview.tsx
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: None
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [x] 7 个文件已删除

  **Commit**: YES
  - Message: `chore: remove unused components and utils`
  - Files: 上述 7 个文件
---

- [x] 2. 删除调试/测试页面

  **What to do**:
  删除以下目录：
  ```
  src/app/test-api/
  src/app/pwa-debug/
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: None
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [x] 2 个目录已删除

  **Commit**: NO (groups with Task 1)
---

- [ ] 3. 删除 PWA 相关文件

  - [x] 3. 删除 PWA 相关文件
  删除以下 PWA 相关文件：
  ```
  src/sw.ts
  src/app/~offline/
  src/components/InstallPWA.tsx
  public/manifest.json
  public/icon-192x192.png
  public/icon-256x256.png
  public/icon-384x384.png
  public/icon-512x512.png
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4-6)
  - **Blocks**: None
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] 所有 PWA 文件已删除

  **Commit**: YES
  - Message: `chore: remove PWA functionality`
  - Files: 上述文件

---

- [x] 4. 更新 next.config.ts

  **What to do**:
  移除 Serwist PWA 配置，简化为：
  ```typescript
  import type { NextConfig } from "next";

  const nextConfig: NextConfig = {
    devIndicators: false,
  };

  export default nextConfig;
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5, 6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `next.config.ts:1-17` - 当前配置

  **Acceptance Criteria**:
  - [ ] Serwist 相关代码已移除
  - [ ] 文件简化为基本 NextConfig

  **Commit**: NO (groups with Task 3)

---

- [x] 5. 更新 package.json

  **What to do**:
  从 dependencies 中移除：
  ```json
  "@serwist/next": "^9.5.6",
  "serwist": "^9.5.6"
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `package.json:11-19` - dependencies 部分

  **Acceptance Criteria**:
  - [ ] @serwist/next 和 serwist 依赖已移除

  **Commit**: NO (groups with Task 3)

---

- [x] 6. 更新 layout.tsx

  **What to do**:
  移除以下 PWA 相关 metadata：
  - `manifest: "/manifest.json"`
  - `appleWebApp` 配置
  - `icons` 配置
  - 移除 InstallPWA 组件导入和使用

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3-5)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/app/layout.tsx` - 当前布局文件

  **Acceptance Criteria**:
  - [ ] PWA 相关 metadata 已移除
  - [ ] InstallPWA 组件已移除

  **Commit**: NO (groups with Task 3)

---

- [x] 7. 编辑 page.tsx 删除 OriginalHomePage

  **What to do**:
  1. 删除 `OriginalHomePage` 函数（约 2000 行）
  2. 清理未使用的导入：
     - `Script` from next/script
     - 所有 pixelation 相关导入（PixelationMode, calculatePixelGrid 等）
     - DownloadSettingsModal
     - imageDownloader 相关导入
     - colorSystemUtils 相关导入
     - 所有组件导入（PixelatedPreviewCanvas, GridTooltip 等）
     - localStorageUtils 相关导入
     - pixelEditingUtils 相关导入
     - DonationModal
     - FocusModePreDownloadModal

  3. 保留的导入：
     - React (useState, useEffect)
     - InstallPWA（如果还在使用，Wave 2 已删除则移除）

  4. 最终文件应该只包含简单的重定向逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: None
  - **Blocked By**: Wave 2 (需要先删除 InstallPWA)

  **References**:
  - `src/app/page.tsx:1-2786` - 完整文件

  **Acceptance Criteria**:
  - [ ] OriginalHomePage 函数已删除
  - [ ] 未使用的导入已清理
  - [ ] 文件只保留简单的重定向逻辑

  **Commit**: YES
  - Message: `refactor: remove OriginalHomePage code`
  - Files: src/app/page.tsx

---

- [x] 8. 删除 OriginalHomePage 相关组件

  **What to do**:
  删除以下组件（删除 OriginalHomePage 后变为无引用）：
  ```
  src/components/DonationModal.tsx
  src/components/FocusModePreDownloadModal.tsx
  src/components/CustomPaletteEditor.tsx
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: None
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] 3 个组件文件已删除

  **Commit**: NO (groups with Task 7)

---

- [x] 9. 删除根目录文档文件

  **What to do**:
  删除以下 11 个文件：
  ```
  API_CONFIG.md
  AZURE_SETUP.md
  AZURE_TROUBLESHOOTING.md
  CONSUME_BEADS_README.md
  FEATURE_SUMMARY.md
  PROXY_SETUP.md
  SETUP_GUIDE.md
  工具说明.md
  VPN与代理说明.md
  色号对应表.csv
  社交媒体简介.txt
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 10)
  - **Blocks**: None
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] 11 个文档文件已删除
  - [ ] README.md 保留

  **Commit**: YES
  - Message: `chore: remove documentation files`
  - Files: 上述 11 个文件

---

- [x] 10. 删除 server.js + scripts/

  **What to do**:
  删除以下文件：
  ```
  server.js
  scripts/ (整个目录)
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 9)
  - **Blocks**: None
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] server.js 已删除
  - [ ] scripts/ 目录已删除

  **Commit**: NO (groups with Task 9)

---

- [ ] 11. 更新 AGENTS.md

  **What to do**:
  更新 AGENTS.md 以反映项目变化：
  1. 移除 PWA 相关说明
  2. 更新项目结构（删除的组件）
  3. 简化环境变量说明（移除代理相关）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5
  - **Blocks**: Verification
  - **Blocked By**: Wave 4

  **References**:
  - `AGENTS.md` - 当前文件

  **Acceptance Criteria**:
  - [ ] PWA 相关说明已移除
  - [ ] 项目结构已更新

  **Commit**: YES
  - Message: `docs: update AGENTS.md after simplification`
  - Files: AGENTS.md

---

## Final Verification Wave

- [ ] F1. **构建验证**

  **What to do**:
  运行 `npm run build` 确保项目可以成功构建

  **Acceptance Criteria**:
  - [ ] `npm run build` 成功无错误

  **QA Scenario**:
  ```
  Scenario: 构建成功
    Tool: Bash
    Steps:
      1. npm run build
    Expected Result: Build completed successfully
    Evidence: .sisyphus/evidence/build-success.log
  ```

- [ ] F2. **功能验证**

  **What to do**:
  运行 `npm run lint` 确保代码质量，然后启动开发服务器验证功能

  **Acceptance Criteria**:
  - [ ] `npm run lint` 无错误
  - [ ] 开发服务器可以启动

  **QA Scenario**:
  ```
  Scenario: Lint 通过
    Tool: Bash
    Steps:
      1. npm run lint
    Expected Result: No lint errors
    Evidence: .sisyphus/evidence/lint-success.log
  ```

---

## Commit Strategy

- **Commit 1**: `chore: remove unused components and utils` (Task 1-2)
- **Commit 2**: `chore: remove PWA functionality` (Task 3-6)
- **Commit 3**: `refactor: remove OriginalHomePage code` (Task 7-8)
- **Commit 4**: `chore: remove documentation files` (Task 9-10)
- **Commit 5**: `docs: update AGENTS.md after simplification` (Task 11)

---

## Success Criteria

### Verification Commands
```bash
npm run build  # Expected: Build completed successfully
npm run lint   # Expected: No errors
npm run dev    # Expected: Server starts on port 3000
```

### Final Checklist
- [ ] 所有未使用的文件已删除
- [ ] PWA 功能已完全移除
- [ ] OriginalHomePage 代码已清理
- [ ] 文档文件已清理（保留 README.md）
- [ ] 配置文件已更新
- [ ] 构建成功
- [ ] Lint 通过
