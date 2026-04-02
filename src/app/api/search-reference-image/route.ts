import { NextRequest, NextResponse } from 'next/server';
import { getProxyAgent } from '../../../utils/proxy';
import { getEnv } from '../../../utils/hotEnv';

/**
 * 搜索参考图片：当用户输入非自然语言名词（如"小八"）时，联网搜索相关图片URL
 * 优先使用 New API 网关，回退到 Google Gemini 直连（含 Google Search）。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;
    const q = typeof query === 'string' ? query.trim() : '';
    if (!q) {
      return NextResponse.json({ error: '缺少 query 参数' }, { status: 400 });
    }

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

    // 优先用 New API 网关（OpenAI 兼容格式）
    const openaiKey = getEnv('OPENAI_API_KEY');
    const openRouterBase = getEnv('OPENROUTER_BASE_URL');

    if (openaiKey && openRouterBase) {
      const endpoint = `${openRouterBase.replace(/\/$/, '')}/chat/completions`;
      // 使用支持搜索的模型
      const model = getEnv('OPENROUTER_SEARCH_MODEL') || 'gpt-4.1-mini';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: searchPrompt },
          ],
          max_tokens: 200,
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content?.trim() || '';
        const imageUrl = extractImageUrl(text);
        if (imageUrl) {
          console.log(`找到参考图(New API): "${q}" → ${imageUrl.substring(0, 100)}...`);
          return NextResponse.json({ imageUrl, found: true });
        }
      }
      console.warn('New API 搜索未找到图片，尝试回退到 Gemini');
    }

    // 回退到 Google Gemini 直连（含 Google Search 联网搜索）
    const googleApiKey = getEnv('GOOGLE_API_KEY') || getEnv('GEMINI_API_KEY');
    if (!googleApiKey) {
      return NextResponse.json({ imageUrl: null, found: false });
    }

    const model = getEnv('GEMINI_TEXT_MODEL') || 'gemini-2.0-flash-exp';
    const baseUrl = getEnv('GOOGLE_API_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${googleApiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: searchPrompt }] }],
        tools: [{ googleSearchRetrieval: {} }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.2 },
      }),
      ...(getProxyAgent() ? { dispatcher: getProxyAgent() as any } : {}),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${response.status}`;
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // 检查是否有 inline 图片数据
    if (data?.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          console.log(`找到参考图(Gemini inline): "${q}"`);
          return NextResponse.json({ imageUrl, found: true });
        }
      }
    }

    const imageUrl = extractImageUrl(text);
    if (imageUrl) {
      console.log(`找到参考图(Gemini): "${q}" → ${imageUrl.substring(0, 100)}...`);
      return NextResponse.json({ imageUrl, found: true });
    }

    console.log(`未找到参考图: "${q}"`);
    return NextResponse.json({ imageUrl: null, found: false });
  } catch (e: any) {
    console.error('search-reference-image error:', e);
    return NextResponse.json(
      { error: e?.message || '搜索参考图失败', imageUrl: null, found: false },
      { status: 500 }
    );
  }
}

/** 从文本中提取图片 URL */
function extractImageUrl(text: string): string | null {
  if (!text || text.includes('NO_IMAGE_FOUND')) return null;

  const urlPatterns = [
    /https?:\/\/[^\s\)"']+\.(jpg|jpeg|png|gif|webp)(\?[^\s\)"']*)?/gi,
  ];
  for (const pattern of urlPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const validUrl = matches.find((url: string) =>
        url.length > 10 &&
        !url.includes('wikipedia.org/wiki') &&
        !url.includes('google.com/search')
      );
      if (validUrl) return validUrl;
    }
  }
  return null;
}
