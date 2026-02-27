import { NextRequest, NextResponse } from 'next/server';
import { getProxyAgent } from '../../../utils/proxy';

/**
 * 搜索参考图片：当用户输入非自然语言名词（如"小八"）时，联网搜索相关图片URL
 * 返回找到的图片URL，用于后续转成拼豆图
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;
    const q = typeof query === 'string' ? query.trim() : '';
    if (!q) {
      return NextResponse.json({ error: '缺少 query 参数' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: '未配置 GOOGLE_API_KEY，无法搜索参考图' },
        { status: 500 }
      );
    }

    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp';
    const baseUrl = process.env.GOOGLE_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${apiKey}`;

    const searchPrompt = `Search the web for information about "${q}". 

From the search results, find and extract image URLs that show what "${q}" looks like. Look for image URLs in:
- Wikipedia articles
- Official websites
- Image hosting sites
- Character reference pages

Important: Extract actual image URLs (ending with .jpg, .jpeg, .png, .gif, or .webp) from the search results, not webpage URLs.

Output format:
- If you find image URLs, output ONE complete image URL (full URL starting with http:// or https://)
- If no image URL is found, output exactly: "NO_IMAGE_FOUND"

Output ONLY the image URL or "NO_IMAGE_FOUND", no explanation, no quotes.`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: searchPrompt }] }],
        tools: [
          {
            googleSearchRetrieval: {} // 启用 Google Search 联网搜索
          }
        ],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.2,
        },
      }),
      ...(getProxyAgent() ? { dispatcher: getProxyAgent() as any } : {}),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${response.status}`;
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    const data = await response.json();
    console.log('Gemini search-reference-image 完整响应:', JSON.stringify(data, null, 2).substring(0, 1000));
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    console.log('Gemini返回的文本:', text);
    
    // 尝试从响应中提取图片URL
    let imageUrl: string | null = null;
    
    // 方法1: 检查响应中是否有图片数据（Gemini可能直接返回图片）
    if (data?.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          // 返回base64图像数据
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          console.log('从响应中提取到base64图片');
          break;
        }
        if (part.imageUrl) {
          imageUrl = part.imageUrl.url;
          console.log('从响应中提取到图片URL:', imageUrl);
          break;
        }
      }
    }
    
    // 方法2: 从文本响应中提取URL（Gemini返回的文字中包含图片链接）
    if (!imageUrl && text && !text.includes('NO_IMAGE_FOUND')) {
      // 匹配各种图片URL格式（更宽松的匹配）
      const urlPatterns = [
        /https?:\/\/[^\s\)"']+\.(jpg|jpeg|png|gif|webp)(\?[^\s\)"']*)?/gi,
        /https?:\/\/[^\s\)"']+\.(jpg|jpeg|png|gif|webp)/gi,
        /https?:\/\/[^\s\)"']+\.(jpg|jpeg|png|gif|webp)/i, // 不区分大小写
      ];
      for (const pattern of urlPatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          // 选择第一个看起来像图片的URL，过滤掉明显不是图片的URL
          const validUrl = matches.find((url: string) => 
            url.length > 10 && 
            !url.includes('wikipedia.org/wiki') && // 排除wiki页面URL
            !url.includes('google.com/search') // 排除搜索页面URL
          );
          if (validUrl) {
            imageUrl = validUrl;
            console.log('从文本中提取到图片URL:', imageUrl);
            break;
          }
        }
      }
    }
    
    if (!imageUrl || imageUrl === 'NO_IMAGE_FOUND') {
      console.log(`未找到参考图: "${q}"`);
      return NextResponse.json({ imageUrl: null, found: false });
    }
    
    console.log(`找到参考图: "${q}" → ${imageUrl.substring(0, 100)}...`);
    return NextResponse.json({ imageUrl, found: true });
  } catch (e: any) {
    console.error('search-reference-image error:', e);
    return NextResponse.json(
      { error: e?.message || '搜索参考图失败', imageUrl: null, found: false },
      { status: 500 }
    );
  }
}
