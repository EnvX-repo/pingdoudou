# API配置说明

本项目支持多种图像生成方式，不同方式需要不同的配置。

## 1. 预设图案模式（推荐，无需API）

**无需配置**，直接从内置图案库中筛选匹配的图案。

- ✅ 免费
- ✅ 无需API key
- ✅ 快速响应
- ⚠️ 图案选择有限

## 2. 算法生成模式（无需API）

**无需配置**，使用算法生成简单几何图案。

- ✅ 免费
- ✅ 无需API key
- ✅ 即时生成
- ⚠️ 图案样式较简单

## 3. AI生成模式（需要API key）

支持多种AI图像生成服务，需要配置相应的API密钥。

### 3.1 OpenAI DALL-E（推荐）

**配置步骤：**

1. 注册OpenAI账号并获取API key：https://platform.openai.com/api-keys

2. 在项目根目录创建 `.env.local` 文件：

```env
OPENAI_API_KEY=sk-your-api-key-here
IMAGE_GENERATION_SERVICE=openai
```

3. 重启开发服务器

**费用：**
- DALL-E 3: $0.04/张（标准质量，1024x1024）
- DALL-E 2: $0.02/张（1024x1024）

**优点：**
- ✅ 图像质量高
- ✅ 生成速度快
- ✅ API稳定

### 3.2 Stable Diffusion（通过Replicate）

**配置步骤：**

1. 注册Replicate账号：https://replicate.com/
2. 获取API token：https://replicate.com/account/api-tokens

3. 在 `.env.local` 文件中配置：

```env
STABLE_DIFFUSION_API_KEY=r8_your-token-here
IMAGE_GENERATION_SERVICE=stablediffusion
STABLE_DIFFUSION_API_URL=https://api.replicate.com/v1/predictions
STABLE_DIFFUSION_MODEL_VERSION=stable-diffusion-xl-base-1.0
```

**费用：**
- 根据使用的模型和生成时间计费
- 通常 $0.002-0.01/张

**优点：**
- ✅ 价格相对便宜
- ✅ 支持多种模型
- ⚠️ 生成速度可能较慢

### 3.3 其他AI服务

你也可以集成其他AI图像生成服务，修改 `src/app/api/generate-image/route.ts` 文件添加新的服务支持。

## 环境变量完整列表

```env
# OpenAI配置
OPENAI_API_KEY=sk-xxx
IMAGE_GENERATION_SERVICE=openai

# Stable Diffusion配置（通过Replicate）
STABLE_DIFFUSION_API_KEY=r8_xxx
IMAGE_GENERATION_SERVICE=stablediffusion
STABLE_DIFFUSION_API_URL=https://api.replicate.com/v1/predictions
STABLE_DIFFUSION_MODEL_VERSION=stable-diffusion-xl-base-1.0

# 其他配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 安全提示

⚠️ **重要：**
- 不要将 `.env.local` 文件提交到Git仓库
- API key应该保密，不要在前端代码中暴露
- 生产环境建议使用环境变量管理服务（如Vercel的环境变量）

## 测试API配置

配置完成后，访问 `/consume-beads` 页面，选择"AI生成"模式，如果配置正确，应该能够成功生成图像。

如果遇到错误，检查：
1. API key是否正确
2. 环境变量是否已加载（需要重启开发服务器）
3. API服务是否可用
4. 网络连接是否正常
