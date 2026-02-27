# Azure OpenAI 故障排除指南

## 当前错误：资源或部署不存在

### 问题分析

错误信息显示"资源或部署不存在"，这通常意味着：

1. **部署名称不正确** - 当前配置的部署名称可能不存在
2. **Azure资源中没有部署DALL-E模型** - 需要先在Azure Portal中创建DALL-E部署

### 解决步骤

#### 步骤1：检查Azure Portal中的部署

1. 登录 Azure Portal：https://portal.azure.com
2. 找到你的 Azure OpenAI 资源（资源名称：`envx-gpt`）
3. 点击左侧菜单的 **"模型部署"** 或 **"Deployments"**
4. 查看已部署的模型列表

#### 步骤2：确认DALL-E部署名称

在部署列表中，查找：
- **DALL-E 3** 或 **DALL-E 2** 的部署
- 记录下确切的部署名称（可能不是 `dall-e-3`）

常见的部署名称可能是：
- `dall-e-3`
- `dall-e-2`
- `dalle3`
- `dalle2`
- 或其他自定义名称

#### 步骤3：如果没有DALL-E部署

如果列表中没有DALL-E部署，需要创建一个：

1. 在"模型部署"页面，点击 **"创建"** 或 **"Create"**
2. 选择模型：
   - **DALL-E 3**（推荐）
   - 或 **DALL-E 2**
3. 输入部署名称（例如：`dall-e-3`）
4. 点击创建并等待部署完成

#### 步骤4：更新配置

找到正确的部署名称后，更新 `.env.local` 文件：

```env
AZURE_OPENAI_DEPLOYMENT_NAME=你的实际部署名称
```

例如，如果部署名称是 `dalle3`，则：

```env
AZURE_OPENAI_DEPLOYMENT_NAME=dalle3
```

#### 步骤5：重启服务器

更新配置后，重启开发服务器：

```bash
# 停止当前服务器（Ctrl+C）
npm run dev
```

## 当前配置

根据你提供的信息，当前配置为：

```env
AZURE_OPENAI_API_KEY=your-azure-openai-api-key-here
AZURE_OPENAI_BASE_URL=https://envx-gpt.openai.azure.com/openai/v1/
AZURE_OPENAI_DEPLOYMENT_NAME=dall-e-3  # ← 这个可能需要修改
AZURE_OPENAI_API_VERSION=2024-02-15-preview
IMAGE_GENERATION_SERVICE=azure
```

## 验证配置

配置完成后，测试步骤：

1. 访问 `/consume-beads` 页面
2. 选择颜色
3. 点击"AI生成图纸"
4. 查看是否成功生成

## 常见问题

**Q: 如何知道部署名称是什么？**
A: 在Azure Portal的"模型部署"页面，部署名称就是列表中显示的名称。

**Q: 我可以使用文本生成的部署吗？**
A: 不可以。图像生成需要专门的DALL-E部署，不能使用GPT模型的部署。

**Q: 部署DALL-E需要多长时间？**
A: 通常几分钟内完成，但具体时间取决于Azure资源的状态。

**Q: 如果我的资源中没有DALL-E模型选项怎么办？**
A: 可能需要：
1. 检查你的Azure订阅是否支持DALL-E
2. 联系Azure支持申请DALL-E访问权限
3. 或者使用标准OpenAI API（需要OpenAI账号）

## 备选方案

如果Azure资源中没有DALL-E，可以考虑：

1. **使用标准OpenAI API**：
   - 在 `.env.local` 中配置 `OPENAI_API_KEY`
   - 设置 `IMAGE_GENERATION_SERVICE=openai`

2. **使用上传图片功能**：
   - 上传图片转换为拼豆图纸
   - 无需API Key，完全免费
