# 拼豆图纸生成器 (Perler Beads Pattern Generator)

> 基于开源项目 [Zippland/perler-beads](https://github.com/Zippland/perler-beads) 二次开发

## 产品定位

**消耗多余豆子** —— 选择你多余的豆子颜色，AI 会生成卡通拼豆图纸，或输入描述 / 上传参考图生成拼豆图纸。

与传统"上传图片 → 生成图纸"的流程相反，本项目解决的是**手里有一堆剩余豆子不知道拼什么**的问题：先选颜色，再生成图案。

## 核心功能

### 1. 消耗多余豆子

- **颜色选择**：从完整的拼豆色板中勾选你手头多余的豆子颜色
- **颜色预设**：保存常用的颜色组合，方便下次直接使用
- **多色号系统**：支持 MARD、COCO、漫漫、盼盼、咪小窝 5 种店家色号体系

### 2. 图案生成（三种模式）

| 模式 | 需要 API Key | 说明 |
|------|:---:|------|
| 🤖 AI 生成（推荐） | 是 | 调用 AI 生成高质量卡通图案，支持自定义描述词和上传参考图 |
| 📚 预设图案 | 否 | 从内置图案库中筛选匹配你选中颜色的图案 |
| 🎨 算法生成 | 否 | Canvas 绘制几何图案，简洁风格 |

AI 生成支持 7 种主题分类：动物、人物、游戏像素、食物、植物、日常物品、场景风景，每次随机切换写实 / 卡通画风。

### 3. 图纸处理

继承自原项目的强大像素化处理能力：

- **智能像素化**：可调粒度、主导色映射
- **颜色合并**：BFS 自动合并相似颜色，消除杂色
- **背景移除**：洪水填充自动识别并移除外部背景
- **颜色排除与重映射**：排除不需要的颜色，自动重映射到最近似颜色
- **手动编辑**：精确修改单个像素的颜色
- **多色板支持**：168 色、144 色、96 色等预设色板

### 4. 专心拼豆模式

- 逐色高亮引导，专注当前颜色
- 完成进度追踪与可视化
- 放大镜工具查看细节区域
- 完成动画庆祝效果

### 5. 导出

- **带 Key 图纸**：下载带颜色编码和网格线的 PNG 图纸
- **颜色统计图**：各颜色色号、色块、所需数量的采购清单

## 技术栈

- **框架**：[Next.js](https://nextjs.org/) 15 + React 19 + TypeScript
- **样式**：[Tailwind CSS](https://tailwindcss.com/) 4
- **图像处理**：浏览器端 Canvas API
- **AI 图像生成**：OpenAI DALL-E / Azure OpenAI / Stable Diffusion（可选）
- **PWA**：Serwist 支持离线访问

## 本地开发

1. 克隆项目：

```bash
git clone https://github.com/EnvX-Repo/pingdoudou.git
cd pingdoudou
```

2. 安装依赖：

```bash
npm install
```

3. （可选）配置 AI 图像生成 API：

```bash
cp .env.local.example .env.local
# 编辑 .env.local 填入你的 API Key
```

4. 启动开发服务器：

```bash
npm run dev
```

5. 在浏览器中打开 `http://localhost:3000`

> 不配置 API Key 也可以使用预设图案和算法生成模式，AI 生成模式需要配置后才可用。

## 致谢

本项目基于 [Zippland/perler-beads](https://github.com/Zippland/perler-beads) 开源项目开发，感谢原作者提供的像素化处理算法和拼豆色板数据。

## 许可证

[Apache 2.0](./LICENSE)
