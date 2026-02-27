import { NextRequest, NextResponse } from 'next/server';
import { getProxyAgent } from '../../../utils/proxy';

// AI图像生成API路由
// 支持多种AI服务：OpenAI DALL-E, Stable Diffusion等

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, colors, referenceImage } = body;

    console.log('收到图像生成请求:', { prompt: prompt?.substring(0, 100), colorsCount: colors?.length, hasReferenceImage: !!referenceImage });

    if (!prompt && !colors) {
      return NextResponse.json(
        { error: '缺少必要参数：prompt 或 colors' },
        { status: 400 }
      );
    }

    // 检查配置的API服务
    const apiService = process.env.IMAGE_GENERATION_SERVICE || 'openai';
    // 优先检测Google API Key（以AIza开头）
    const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const apiKey = googleApiKey || process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;

    console.log('API配置:', { 
      apiService, 
      hasGoogleKey: !!googleApiKey,
      hasApiKey: !!apiKey,
      keyPrefix: apiKey?.substring(0, 10) + '...'
    });

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: '未配置图像生成API密钥',
          message: '请在环境变量中设置 GOOGLE_API_KEY、OPENAI_API_KEY、AZURE_OPENAI_API_KEY 或 STABLE_DIFFUSION_API_KEY'
        },
        { status: 500 }
      );
    }

    let imageUrl: string;

    // 自动检测API类型
    const detectedService = googleApiKey ? 'google' : apiService.toLowerCase();
    console.log('检测到的服务类型:', detectedService);

    switch (detectedService) {
      case 'google':
      case 'gemini':
        imageUrl = await generateWithGoogleGemini(prompt, colors, apiKey, referenceImage);
        break;
      case 'openai':
        imageUrl = await generateWithOpenAI(prompt, colors, apiKey);
        break;
      case 'azure':
      case 'azure-openai':
        imageUrl = await generateWithAzureOpenAI(prompt, colors, apiKey);
        break;
      case 'stablediffusion':
      case 'stable-diffusion':
        imageUrl = await generateWithStableDiffusion(prompt, colors, apiKey);
        break;
      default:
        return NextResponse.json(
          { error: `不支持的API服务: ${detectedService}` },
          { status: 400 }
        );
    }

    console.log('图像生成成功，URL长度:', imageUrl?.length || 0);
    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error('图像生成错误:', error);
    if (error?.stack) console.error('错误堆栈:', error.stack);
    const msg = error?.message || '未知错误';
    // 栈溢出/数据过大不算网络错误，避免误导用户
    const isStackOrData = /Maximum call stack size exceeded|stack size exceeded/i.test(msg);
    const isNetworkError = !isStackOrData && (
      msg.includes('fetch failed') ||
      msg.includes('连接超时') ||
      msg.includes('网络连接') ||
      error?.code === 'UND_ERR_CONNECT_TIMEOUT'
    );
    const friendlyError = isStackOrData
      ? '处理失败（请求或响应数据过大，请尝试不上传参考图或使用更小图片）'
      : (isNetworkError ? '网络连接失败' : '图像生成失败');
    return NextResponse.json(
      {
        error: friendlyError,
        message: isStackOrData ? msg : msg,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
        isNetworkError,
      },
      { status: 500 }
    );
  }
}

// Google Gemini图像生成
async function generateWithGoogleGemini(
  prompt: string,
  colors: string[],
  apiKey: string,
  referenceImage?: string
): Promise<string> {
  // 构建包含颜色的提示词
  const colorDescriptions = colors.map(hex => {
    return `color ${hex}`;
  });

  const basePrompt = prompt || `A pixel art pattern using these colors: ${colorDescriptions.join(', ')}. Simple, clean design.`;
  // 强制 Gemini 直接出图：避免返回“你想画什么？”等文字反问导致无法提取图像
  const fullPrompt =
    `You must generate exactly one image. Do not ask the user any questions. Do not respond with text—output only the image. Image description: ${basePrompt}`;

  // Google Gemini图像生成endpoint
  // 支持的模型：gemini-2.5-flash-image (Nano Banana) 或 gemini-3-pro-image-preview (Nano Banana Pro)
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const baseUrl = process.env.GOOGLE_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${apiKey}`;

  console.log('Google Gemini API调用:', endpoint);
  console.log('使用模型:', model);

  // 创建AbortController用于超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

  let response: Response;
  try {
    // 检查是否配置了代理
    const proxyAgent = getProxyAgent();
    
    // 构建parts数组：如果有参考图，先添加图片，再添加文本
    const parts: any[] = [];
    if (referenceImage) {
      // 处理参考图：如果是base64，提取数据；如果是URL，需要先下载（这里简化处理，假设是base64）
      let imageData: string;
      let mimeType: string = 'image/png';
      
      if (referenceImage.startsWith('data:')) {
        // base64格式：data:image/png;base64,xxx
        const match = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          imageData = match[2];
        } else {
          // 如果没有mime type，尝试提取base64部分
          const base64Match = referenceImage.match(/base64,(.+)$/);
          imageData = base64Match ? base64Match[1] : referenceImage;
        }
      } else {
        // URL格式：需要先下载（这里简化，假设前端会传base64）
        throw new Error('参考图URL格式暂不支持，请使用base64格式');
      }
      
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageData
        }
      });
    }
    
    parts.push({
      text: fullPrompt
    });
    
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: parts
          }
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'], // Gemini要求同时返回文本和图像
        },
      }),
      signal: controller.signal,
    };
    
    // 如果配置了代理，添加到fetch选项
    if (proxyAgent) {
      (fetchOptions as any).dispatcher = proxyAgent;
      console.log('使用代理连接Google Gemini API');
    }
    
    response = await fetch(endpoint, fetchOptions);
    clearTimeout(timeoutId);
  } catch (error: any) {
    clearTimeout(timeoutId);
    const errMsg = error?.message || '未知错误';
    if (error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      throw new Error(`网络连接超时。可能的原因：
1. 防火墙或网络限制阻止了访问Google API
2. 需要配置代理才能访问
3. 网络环境限制（某些地区可能无法直接访问）
4. DNS解析问题

建议解决方案：
- 检查防火墙设置，允许访问 generativelanguage.googleapis.com
- 如果在中国大陆，可能需要使用VPN或代理
- 或者使用"上传图片"功能（无需API调用，完全免费）`);
    }
    if (/Maximum call stack size exceeded|stack size exceeded/i.test(errMsg)) {
      throw new Error('请求或响应数据过大导致处理失败，请尝试不上传参考图或使用更小的图片');
    }
    throw new Error(`网络连接失败: ${errMsg}`);
  }

  if (!response.ok) {
    let errorMessage = '未知错误';
    try {
      const error = await response.json();
      errorMessage = error.error?.message || error.message || `HTTP ${response.status}`;
      
      // 处理常见的API错误
      if (response.status === 401 || response.status === 403) {
        errorMessage = 'API Key无效或权限不足，请检查GOOGLE_API_KEY配置';
      } else if (response.status === 404) {
        errorMessage = `模型不存在。请检查：
1. 模型名称是否正确（当前: ${model}）
2. 支持的模型：
   - gemini-2.5-flash-image (Nano Banana，推荐)
   - gemini-3-pro-image-preview (Nano Banana Pro，高质量)`;
      } else if (response.status === 429) {
        errorMessage = 'API调用次数超限，请稍后再试';
      } else if (response.status === 500) {
        errorMessage = 'Google Gemini服务器错误，请稍后再试';
      }
    } catch (e) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(`Google Gemini API错误: ${errorMessage}`);
  }

  const data = await response.json();
  try {
    const preview = typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : String(data).substring(0, 500);
    console.log('Google Gemini响应:', preview);
  } catch (_) {
    console.log('Google Gemini响应: (无法序列化，可能过大或含循环引用)');
  }
  
  // Google Gemini返回格式：candidates[0].content.parts[] 中包含图像
  if (data.candidates && data.candidates[0]) {
    const candidate = data.candidates[0];
    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        // 标准格式：inlineData.data
        if (part.inlineData && part.inlineData.data) {
          const imageData = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          console.log('成功提取图像数据(inlineData)，长度:', imageData.length);
          return imageData;
        }
        if (part.imageUrl) {
          console.log('找到图像URL:', part.imageUrl.url);
          return part.imageUrl.url;
        }
        // 代理/部分实现返回 Markdown 格式：![image](data:image/png;base64,...)
        if (part.text && typeof part.text === 'string') {
          const mdMatch = part.text.match(/!\[[^\]]*\]\((data:image\/(png|jpeg|jpg|gif|webp);base64,[^)]+)\)/i);
          if (mdMatch) {
            const imageData = mdMatch[1];
            console.log('成功提取图像数据(text内Markdown)，长度:', imageData.length);
            return imageData;
          }
        }
      }
    }
  }
  
  let errPreview = '';
  try {
    errPreview = JSON.stringify(data).substring(0, 200);
  } catch (_) {
    errPreview = '(响应体无法序列化)';
  }
  console.error('Google Gemini返回数据异常，预览:', errPreview);
  throw new Error('Google Gemini返回格式异常，无法提取图像数据');
}

// OpenAI DALL-E生成（支持OpenRouter）
async function generateWithOpenAI(
  prompt: string,
  colors: string[],
  apiKey: string
): Promise<string> {
  // 构建包含颜色的提示词
  const colorDescriptions = colors.map(hex => {
    return `color ${hex}`;
  });

  const fullPrompt = prompt || `A pixel art pattern using these colors: ${colorDescriptions.join(', ')}. Simple, clean design.`;

  // 检查是否是OpenRouter API key（格式：sk-or-v1-...）
  const isOpenRouter = apiKey.startsWith('sk-or-v1-');
  
  if (isOpenRouter) {
    // OpenRouter使用chat/completions端点进行图像生成
    return await generateWithOpenRouter(prompt, colors, apiKey, fullPrompt);
  } else {
    // 标准OpenAI使用images/generations端点
    return await generateWithStandardOpenAI(fullPrompt, apiKey);
  }
}

// OpenRouter图像生成（使用chat/completions端点）
async function generateWithOpenRouter(
  prompt: string,
  colors: string[],
  apiKey: string,
  fullPrompt: string
): Promise<string> {
  const endpoint = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1') + '/chat/completions';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://github.com',
    'X-Title': process.env.OPENROUTER_X_TITLE || 'Perler Beads Generator',
  };

  // OpenRouter支持的图像生成模型
  // 支持的模型：google/gemini-2.5-flash-image, openai/gpt-5-image-mini, bytedance/seedream-4.5
  // 默认使用性价比高的模型
  const imageModel = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: imageModel,
      messages: [
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      modalities: ['image'], // 指定输出图像
    }),
  });

  if (!response.ok) {
    let errorMessage = '未知错误';
    try {
      const error = await response.json();
      errorMessage = error.error?.message || error.message || `HTTP ${response.status}`;
      
      if (response.status === 401) {
        errorMessage = 'API Key无效或已过期，请检查OPENAI_API_KEY配置';
      } else if (response.status === 404) {
        errorMessage = `模型不存在或未找到。请检查：
1. 模型名称是否正确（当前: ${imageModel}）
2. 可以尝试其他图像生成模型：
   - google/gemini-2.5-flash-image (推荐)
   - openai/gpt-5-image-mini
   - bytedance/seedream-4.5
3. 在.env.local中设置OPENROUTER_IMAGE_MODEL`;
      } else if (response.status === 429) {
        errorMessage = 'API调用次数超限，请稍后再试';
      } else if (response.status === 500) {
        errorMessage = 'OpenRouter服务器错误，请稍后再试';
      }
    } catch (e) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(`OpenRouter API错误: ${errorMessage}`);
  }

  const data = await response.json();
  
  // OpenRouter返回格式：choices[0].message.content 或 choices[0].message.images
  if (data.choices && data.choices[0]) {
    const message = data.choices[0].message;
    // 检查是否有images数组
    if (message.images && message.images.length > 0) {
      return message.images[0].image_url?.url || message.images[0].url;
    }
    // 检查content中是否有图像URL
    if (message.content) {
      const imageMatch = message.content.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i);
      if (imageMatch) {
        return imageMatch[0];
      }
    }
  }
  
  throw new Error('OpenRouter返回格式异常，无法提取图像URL');
}

// 标准OpenAI图像生成
async function generateWithStandardOpenAI(
  fullPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    }),
  });

  if (!response.ok) {
    let errorMessage = '未知错误';
    try {
      const error = await response.json();
      errorMessage = error.error?.message || error.message || `HTTP ${response.status}`;
      
      // 处理常见的API错误
      if (response.status === 401) {
        errorMessage = 'API Key无效或已过期，请检查OPENAI_API_KEY配置';
      } else if (response.status === 404) {
        errorMessage = '端点不存在，请检查API配置';
      } else if (response.status === 429) {
        errorMessage = 'API调用次数超限，请稍后再试';
      } else if (response.status === 500) {
        errorMessage = 'OpenAI服务器错误，请稍后再试';
      }
    } catch (e) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(`OpenAI API错误: ${errorMessage}`);
  }

  const data = await response.json();
  return data.data[0].url;
}

// Azure OpenAI DALL-E生成
async function generateWithAzureOpenAI(
  prompt: string,
  colors: string[],
  apiKey: string
): Promise<string> {
  // 构建包含颜色的提示词
  const colorDescriptions = colors.map(hex => {
    return `color ${hex}`;
  });

  const fullPrompt = prompt || `A pixel art pattern using these colors: ${colorDescriptions.join(', ')}. Simple, clean design.`;

  // Azure OpenAI配置
  const baseUrl = process.env.AZURE_OPENAI_BASE_URL || '';
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'dall-e-3';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
  const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME || '';

  // 构建Azure OpenAI endpoint
  // Azure DALL-E endpoint格式: https://{resource-name}.openai.azure.com/openai/deployments/{deployment-name}/images/generations?api-version={api-version}
  let endpoint: string;
  
  if (baseUrl) {
    // 从Base URL提取资源名称和基础URL
    // Base URL格式: https://envx-gpt.openai.azure.com/openai/v1/
    // 需要转换为: https://envx-gpt.openai.azure.com/openai/deployments/{deployment}/images/generations
    const urlMatch = baseUrl.match(/https:\/\/([^\/]+)\.openai\.azure\.com/);
    if (urlMatch && urlMatch[1]) {
      const extractedResourceName = urlMatch[1];
      endpoint = `https://${extractedResourceName}.openai.azure.com/openai/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`;
    } else {
      // 如果无法解析，尝试直接替换
      endpoint = baseUrl.replace('/v1/', `/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`);
    }
  } else if (resourceName) {
    endpoint = `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`;
  } else {
    throw new Error('未配置Azure OpenAI资源信息，请设置AZURE_OPENAI_BASE_URL或AZURE_OPENAI_RESOURCE_NAME');
  }
  
  console.log('Azure OpenAI endpoint:', endpoint);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey, // Azure使用api-key header
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    }),
  });

  if (!response.ok) {
    let errorMessage = '未知错误';
    try {
      const error = await response.json();
      errorMessage = error.error?.message || error.message || `HTTP ${response.status}`;
      
      // 处理常见的API错误
      if (response.status === 401) {
        errorMessage = 'API Key无效或已过期，请检查AZURE_OPENAI_API_KEY配置';
      } else if (response.status === 404) {
        errorMessage = `资源或部署不存在。请检查：
1. 部署名称是否正确（当前: ${deploymentName}）
2. Azure资源中是否已部署DALL-E模型
3. 部署名称可在Azure Portal的"模型部署"页面查看`;
      } else if (response.status === 429) {
        errorMessage = 'API调用次数超限，请稍后再试';
      } else if (response.status === 500) {
        errorMessage = 'Azure OpenAI服务器错误，请稍后再试';
      }
    } catch (e) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(`Azure OpenAI API错误: ${errorMessage}`);
  }

  const data = await response.json();
  return data.data[0].url;
}

// Stable Diffusion生成（示例，需要根据实际API调整）
async function generateWithStableDiffusion(
  prompt: string,
  colors: string[],
  apiKey: string
): Promise<string> {
  // 这里需要根据你使用的Stable Diffusion API进行调整
  // 示例：Replicate API
  const apiUrl = process.env.STABLE_DIFFUSION_API_URL || 'https://api.replicate.com/v1/predictions';

  const colorDescriptions = colors.map(hex => `color ${hex}`).join(', ');
  const fullPrompt = prompt || `A pixel art pattern using these colors: ${colorDescriptions}. Simple, clean design.`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify({
      version: process.env.STABLE_DIFFUSION_MODEL_VERSION || 'stable-diffusion-xl-base-1.0',
      input: {
        prompt: fullPrompt,
        width: 1024,
        height: 1024,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Stable Diffusion API错误: ${error.detail || '未知错误'}`);
  }

  const data = await response.json();
  
  // 等待生成完成（实际应用中应该使用轮询或webhook）
  // 这里简化处理
  return data.output?.[0] || data.urls?.get || '';
}
