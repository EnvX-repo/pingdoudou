# Azure OpenAI 配置指南

## 配置步骤

你提供的API Key格式是Azure OpenAI的格式。请按以下步骤配置：

### 1. 更新 .env.local 文件

```env
# Azure OpenAI API配置
AZURE_OPENAI_API_KEY=93df748d31fb46618526a2266d54a6a3
AZURE_OPENAI_RESOURCE_NAME=your-resource-name
AZURE_OPENAI_DEPLOYMENT_NAME=dall-e-3
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# 图像生成服务
IMAGE_GENERATION_SERVICE=azure
```

### 2. 获取Azure资源信息

你需要从Azure门户获取以下信息：

1. **资源名称 (AZURE_OPENAI_RESOURCE_NAME)**
   - 登录 Azure Portal
   - 找到你的 Azure OpenAI 资源
   - 资源名称通常在资源的"概览"页面可以看到
   - 格式类似：`my-openai-resource`

2. **部署名称 (AZURE_OPENAI_DEPLOYMENT_NAME)**
   - 在Azure OpenAI资源中，进入"模型部署"页面
   - 找到你的DALL-E部署
   - 部署名称通常是：`dall-e-3` 或 `dall-e-2`

3. **API版本 (AZURE_OPENAI_API_VERSION)**
   - 通常使用：`2024-02-15-preview`
   - 或查看Azure文档获取最新版本

### 3. 示例配置

假设你的Azure资源信息如下：
- 资源名称：`my-openai-resource`
- 部署名称：`dall-e-3`
- API版本：`2024-02-15-preview`

那么 `.env.local` 文件应该是：

```env
AZURE_OPENAI_API_KEY=93df748d31fb46618526a2266d54a6a3
AZURE_OPENAI_RESOURCE_NAME=my-openai-resource
AZURE_OPENAI_DEPLOYMENT_NAME=dall-e-3
AZURE_OPENAI_API_VERSION=2024-02-15-preview
IMAGE_GENERATION_SERVICE=azure
```

### 4. 重启开发服务器

配置完成后，重启开发服务器：

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

## 常见问题

**Q: 如何找到资源名称？**
A: 在Azure Portal中，打开你的Azure OpenAI资源，在"概览"页面的"资源名称"字段可以看到。

**Q: 如何找到部署名称？**
A: 在Azure OpenAI资源中，点击左侧菜单的"模型部署"，你会看到所有部署的列表，部署名称就是列表中的名称。

**Q: 如果我没有部署DALL-E怎么办？**
A: 你需要在Azure OpenAI资源中创建一个DALL-E模型的部署。进入"模型部署"页面，点击"创建"，选择DALL-E模型（如dall-e-3），然后创建部署。

**Q: API版本应该填什么？**
A: 通常使用 `2024-02-15-preview`，这是支持DALL-E的最新版本。你也可以查看Azure OpenAI的API文档获取最新版本。

## 验证配置

配置完成后，访问 `/consume-beads` 页面，选择颜色后点击"AI生成图纸"。如果配置正确，应该能成功生成图像。

如果遇到错误，请检查：
1. 资源名称是否正确
2. 部署名称是否存在
3. API Key是否有效
4. 部署的模型是否是DALL-E
