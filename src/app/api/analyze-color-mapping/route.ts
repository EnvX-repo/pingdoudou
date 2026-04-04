import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '../../../utils/hotEnv';

/**
 * 分析像素化结果与原图的差异，给出颜色替换建议。
 * 用文本/视觉模型对比两张图，在限定色板范围内建议全局颜色替换。
 *
 * 输入：originalImage (base64), pixelatedImage (base64), palette (hex[]), colorCounts ({hex: count})
 * 输出：{ replacements: [{from, to, reason}] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalImage, pixelatedImage, palette, colorCounts } = body;

    if (!originalImage || !pixelatedImage || !palette?.length) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 构建色板信息和当前使用情况
    const paletteList = (palette as string[]).join(', ');
    const usageLines = Object.entries(colorCounts as Record<string, number>)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([hex, count]) => `${hex}: ${count} beads`)
      .join('\n');

    const systemPrompt = `You are a color analysis assistant for a perler bead (拼豆) pattern generator.

You will receive TWO images:
1. Image 1: the ORIGINAL reference image
2. Image 2: the PIXELATED version, already mapped to a limited bead color palette

You will also receive the available palette colors and their current usage counts.

Your task: compare the two images and suggest color REPLACEMENTS to make the pixelated version more faithful to the original. Each replacement is a GLOBAL swap — every cell of color A becomes color B.

STRICT RULES:
- Both "from" and "to" MUST be hex values from the provided palette list. Do NOT invent new colors.
- Only suggest changes that noticeably improve visual fidelity to the original.
- Do NOT suggest replacing a color with itself.
- Do NOT suggest swaps that would hurt other regions (consider that the replacement is global).
- Maximum 5 replacements. If the pixelated version already looks good, return an empty array.
- Focus on the most impactful issues: wrong skin tone, wrong hair color, mismatched background, etc.

Available palette:
${paletteList}

Current color usage in pixelated image:
${usageLines}

Respond with ONLY a valid JSON array, no markdown fences, no explanation:
[{"from": "#AABBCC", "to": "#DDEEFF", "reason": "brief reason"}]
If no changes needed: []`;

    // 解析 base64 图片数据
    const parseBase64 = (dataUrl: string) => {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) return { mimeType: match[1], data: match[2] };
      const b64Match = dataUrl.match(/base64,(.+)$/);
      return { mimeType: 'image/png', data: b64Match ? b64Match[1] : dataUrl };
    };

    const orig = parseBase64(originalImage);
    const pix = parseBase64(pixelatedImage);

    // 优先用 New API 网关（OpenAI 兼容 vision 格式）
    const openaiKey = getEnv('OPENAI_API_KEY');
    const openRouterBase = getEnv('OPENROUTER_BASE_URL');

    if (openaiKey && openRouterBase) {
      const endpoint = `${openRouterBase.replace(/\/$/, '')}/chat/completions`;
      const model = getEnv('OPENROUTER_VISION_MODEL') || getEnv('OPENROUTER_TEXT_MODEL') || 'gpt-4.1-mini';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${orig.mimeType};base64,${orig.data}` },
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:${pix.mimeType};base64,${pix.data}` },
                },
                {
                  type: 'text',
                  text: 'Compare these two images. Image 1 is the original, Image 2 is the pixelated bead version. Suggest color replacements as instructed.',
                },
              ],
            },
          ],
          max_tokens: 500,
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content?.trim() || '[]';
        console.log('颜色分析原始返回:', raw);
        const replacements = parseReplacements(raw, palette);
        return NextResponse.json({ replacements });
      }
      const errText = await response.text().catch(() => '');
      console.warn('New API 颜色分析失败:', response.status, errText);
    }

    // 回退到 Google Gemini 直连
    const googleApiKey = getEnv('GOOGLE_API_KEY') || getEnv('GEMINI_API_KEY');
    if (!googleApiKey) {
      console.warn('未配置视觉 API，跳过颜色分析');
      return NextResponse.json({ replacements: [] });
    }

    const model = getEnv('GEMINI_TEXT_MODEL') || 'gemini-2.0-flash-exp';
    const baseUrl = getEnv('GOOGLE_API_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${googleApiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: orig.mimeType, data: orig.data } },
              { inlineData: { mimeType: pix.mimeType, data: pix.data } },
              { text: `${systemPrompt}\n\nCompare these two images. Image 1 is the original, Image 2 is the pixelated bead version. Suggest color replacements.` },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 500, temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn('Gemini 颜色分析失败:', err?.error?.message || response.status);
      return NextResponse.json({ replacements: [] });
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';
    console.log('Gemini 颜色分析原始返回:', raw);
    const replacements = parseReplacements(raw, palette);
    return NextResponse.json({ replacements });
  } catch (e: any) {
    console.error('analyze-color-mapping error:', e);
    return NextResponse.json({ replacements: [] });
  }
}

/** 解析并验证 AI 返回的替换建议，确保所有颜色都在色板内 */
function parseReplacements(
  raw: string,
  palette: string[]
): { from: string; to: string; reason: string }[] {
  try {
    // 去掉可能的 markdown 代码块包裹
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];

    const paletteSet = new Set(palette.map((h: string) => h.toUpperCase()));

    return arr
      .filter(
        (item: any) =>
          item?.from &&
          item?.to &&
          typeof item.from === 'string' &&
          typeof item.to === 'string' &&
          item.from.toUpperCase() !== item.to.toUpperCase() &&
          paletteSet.has(item.from.toUpperCase()) &&
          paletteSet.has(item.to.toUpperCase())
      )
      .slice(0, 5)
      .map((item: any) => ({
        from: item.from.toUpperCase(),
        to: item.to.toUpperCase(),
        reason: item.reason || '',
      }));
  } catch {
    console.warn('解析颜色替换建议失败:', raw);
    return [];
  }
}
