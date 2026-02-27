# 代理配置指南

如果无法直接访问 Google Gemini API（网络连接超时），可以通过配置代理来解决。

## 方法1：使用环境变量配置代理（推荐）

### 步骤1：获取代理地址

如果你有代理服务器，格式通常是：
- HTTP代理：`http://proxy.example.com:8080`
- SOCKS5代理：`socks5://proxy.example.com:1080`
- 需要认证：`http://username:password@proxy.example.com:8080`

### 步骤2：配置环境变量

在 `.env.local` 文件中添加代理配置：

```env
# 代理配置（二选一）
HTTPS_PROXY=http://127.0.0.1:7890
# 或
HTTP_PROXY=http://127.0.0.1:7890

# Google Gemini API配置
GOOGLE_API_KEY=你的API密钥
IMAGE_GENERATION_SERVICE=google
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

**常见代理端口：**
- Clash: `http://127.0.0.1:7890`
- V2Ray: `http://127.0.0.1:10808`
- Shadowsocks: `socks5://127.0.0.1:1080`
- 系统代理：查看系统设置中的代理端口

### 步骤3：重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

## 方法2：使用系统代理设置

如果你的系统已经配置了代理，Node.js 可能无法自动使用。可以尝试：

### Windows PowerShell:

```powershell
# 设置环境变量（仅当前会话有效）
$env:HTTPS_PROXY="http://127.0.0.1:7890"
$env:HTTP_PROXY="http://127.0.0.1:7890"

# 然后启动服务器
npm run dev
```

### Windows CMD:

```cmd
set HTTPS_PROXY=http://127.0.0.1:7890
set HTTP_PROXY=http://127.0.0.1:7890
npm run dev
```

## 方法3：检查系统代理设置

### Windows:
1. 打开"设置" > "网络和Internet" > "代理"
2. 查看"手动代理设置"中的地址和端口
3. 将地址和端口配置到 `.env.local` 中

### 常见代理软件默认端口：
- **Clash for Windows**: `http://127.0.0.1:7890`
- **V2RayN**: `http://127.0.0.1:10808`
- **Shadowsocks**: `socks5://127.0.0.1:1080`
- **Proxifier**: 查看软件设置

## 测试代理是否生效

配置代理后，访问测试页面：`http://localhost:3000/test-api`

如果看到服务器日志中显示：
```
✅ 代理配置成功: http://127.0.0.1:7890
使用代理连接Google Gemini API
```

说明代理配置成功。

## 故障排除

### 问题1：代理配置后仍然超时

**可能原因：**
1. 代理地址或端口不正确
2. 代理服务器未运行
3. 代理需要认证但未配置用户名密码

**解决方法：**
1. 检查代理软件是否正在运行
2. 测试代理是否可用：
   ```bash
   curl -x http://127.0.0.1:7890 https://www.google.com
   ```
3. 如果代理需要认证，使用格式：`http://username:password@proxy:port`

### 问题2：不知道代理地址

**查找方法：**
1. 查看代理软件的设置页面
2. 查看系统代理设置
3. 如果使用VPN，查看VPN软件的代理设置

### 问题3：不想使用代理

如果无法配置代理，可以使用**上传图片功能**：
- 完全免费
- 无需API调用
- 无需网络连接Google API
- 访问：`http://localhost:3000/consume-beads`

## 示例配置

### Clash for Windows:
```env
HTTPS_PROXY=http://127.0.0.1:7890
HTTP_PROXY=http://127.0.0.1:7890
```

### V2RayN:
```env
HTTPS_PROXY=http://127.0.0.1:10808
HTTP_PROXY=http://127.0.0.1:10808
```

### Shadowsocks (SOCKS5):
```env
HTTPS_PROXY=socks5://127.0.0.1:1080
HTTP_PROXY=socks5://127.0.0.1:1080
```

## 注意事项

1. **安全性**：不要将包含密码的代理配置提交到Git仓库
2. **性能**：使用代理可能会稍微降低API调用速度
3. **稳定性**：确保代理服务器稳定运行
