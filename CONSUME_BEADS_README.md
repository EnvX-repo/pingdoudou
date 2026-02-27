# 消耗多余豆子功能使用说明

## 功能概述

"消耗多余豆子"功能是一个反向的拼豆图纸生成工具。与传统的"上传图片→生成图纸"流程不同，这个功能允许你：

1. **选择你已有的豆子颜色**
2. **系统生成使用这些颜色的拼豆图纸**

这样可以帮助你消耗掉多余的豆子，避免浪费。

## 使用方法

### 1. 访问功能页面

- 在首页点击"消耗多余豆子"按钮
- 或直接访问：`/consume-beads`

### 2. 选择颜色

- 在颜色选择器中，点击你已有的豆子颜色
- 可以点击"全选"或"清空"快速操作
- 已选择的颜色数量会实时显示

### 3. 选择生成方式

系统提供三种生成方式：

#### 📚 预设图案模式（推荐）
- **无需API key**
- 从内置图案库中筛选主要使用你选择颜色的图案
- 快速、免费、即时可用

#### 🎨 算法生成模式
- **无需API key**
- 使用算法生成简单的几何图案
- 适合喜欢简洁风格的用户

#### 🤖 AI生成模式
- **需要配置API key**
- 使用AI生成创意图案
- 可以输入自定义提示词
- 需要配置图像生成API（如OpenAI DALL-E）

### 4. 生成图纸

- 点击"生成拼豆图纸"按钮
- 系统会自动跳转到主页面进行像素化处理
- 在主页面可以调整精细度、颜色合并等参数
- 最终下载拼豆图纸和采购清单

## API配置（仅AI生成模式需要）

### OpenAI DALL-E配置

1. 注册OpenAI账号：https://platform.openai.com/
2. 获取API key：https://platform.openai.com/api-keys
3. 在项目根目录创建 `.env.local` 文件：

```env
OPENAI_API_KEY=sk-your-api-key-here
IMAGE_GENERATION_SERVICE=openai
```

4. 重启开发服务器

**费用：** DALL-E 3 约 $0.04/张

### Stable Diffusion配置（可选）

1. 注册Replicate账号：https://replicate.com/
2. 获取API token：https://replicate.com/account/api-tokens
3. 在 `.env.local` 文件中配置：

```env
STABLE_DIFFUSION_API_KEY=r8_your-token-here
IMAGE_GENERATION_SERVICE=stablediffusion
```

详细配置说明请参考 [API_CONFIG.md](./API_CONFIG.md)

## 技术实现

### 工作流程

1. **颜色选择** → 用户选择已有的豆子颜色
2. **图像生成** → 根据选择的模式生成图像
   - 预设图案：从图案库筛选
   - 算法生成：Canvas绘制几何图案
   - AI生成：调用AI API生成图像
3. **像素化处理** → 跳转到主页面，使用原项目的像素化算法
4. **颜色限制** → 自动限制调色板为选中的颜色
5. **图纸生成** → 生成最终的拼豆图纸

### 核心文件

- `src/app/consume-beads/page.tsx` - 主页面
- `src/components/ConsumeBeads/ColorPaletteSelector.tsx` - 颜色选择器
- `src/components/ConsumeBeads/ImageGenerationOptions.tsx` - 生成选项
- `src/app/api/generate-image/route.ts` - AI图像生成API

## 未来改进计划

- [ ] 添加更多预设图案
- [ ] 优化算法生成图案的多样性
- [ ] 支持更多AI服务（Midjourney、Stable Diffusion等）
- [ ] 添加图案预览和筛选功能
- [ ] 支持保存常用颜色组合
- [ ] 添加图案难度评级

## 常见问题

**Q: 为什么AI生成模式需要API key？**
A: AI图像生成需要调用第三方API服务，这些服务通常需要付费。预设图案和算法生成模式完全免费，不需要API key。

**Q: 可以同时使用多种颜色吗？**
A: 可以！选择任意数量的颜色，系统会生成使用这些颜色的图案。

**Q: 生成的图案质量如何？**
A: 
- 预设图案：质量取决于图案库的质量
- 算法生成：简单几何图案，适合初学者
- AI生成：质量最高，但需要API费用

**Q: 如何添加更多预设图案？**
A: 可以在 `selectPresetPattern` 函数中添加图案库，或联系开发者贡献图案。

## 贡献

欢迎提交PR和Issue！如果你有好的预设图案或改进建议，欢迎分享。
