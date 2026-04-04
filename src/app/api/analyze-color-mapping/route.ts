import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '../../../utils/hotEnv';

/**
 * 分析像素化结果与原图的差异，给出：
 * 1. 全局颜色替换建议 (replacements)
 * 2. 边界专用颜色修正建议 (boundaryFixes) — 仅应用于主体边缘格子
 *
 * 输入：originalImage (base64), pixelatedImage (base64), palette (hex[]), colorCounts ({hex: count})
 * 输出：{ replacements: [{from, to, reason}], boundaryFixes: [{from, to, reason}] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalImage, pixelatedImage, palette, colorCounts } = body;

    if (!originalImage || !pixelatedImage || !palette?.length) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const paletteList = (palette as string[]).join(', ');
    const usageLines = Object.entries(colorCounts as Record<string, number>)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([hex, count]) => `${hex}: ${count} beads`)
      .join('\n');

    const systemPrompt = `You are a color analysis assistant for a perler bead (拼豆) pattern generator.

You will receive TWO images:
1. Image 1: the ORIGINAL reference image
2. Image 2: the PIXELATED version, already mapped to a limited bead color palette

Your task: compare the two images and provide TWO types of suggestions:

## TYPE 1: Global replacements
Color swaps that apply to ALL cells of that color throughout the entire image.
Focus on: wrong skin tone, wrong hair color, overall color accuracy.
Maximum 5. Only suggest if it clearly improves fidelity without hurting other regions.

## TYPE 2: Boundary fixes
Color swaps that should ONLY apply to cells at the EDGE of the subject (cells next to the background).
This fixes a common problem: when the original has a colored background (e.g. pink) and the subject has a different color (e.g. white), the pixelation process sometimes leaves background-colored pixels bleeding into the subject's edge.
Look at the EDGE/OUTLINE of the pixelated subject:
- Are there cells at the border that have the background color instead of the subject's color?
- Are there edge cells whose color doesn't match what the original shows at that location?
Maximum 5 boundary fixes.

STRICT RULES:
- Both "from" and "to" MUST be hex values from the provided palette list. Do NOT invent new colors.
- Do NOT suggest replacing a color with itself.
- For boundary fixes, "from" is the wrong color at the edge, "to" is what it should be based on the original.

Available palette:
${paletteList}

Current color usage in pixelated image:
${usageLines}

Respond with ONLY a valid JSON object (no markdown fences, no explanation):
{"replacements": [{"from": "#AA", "to": "#BB", "reason": "..."}], "boundaryFixes": [{"from": "#CC", "to": "#DD", "reason": "..."}]}
If no changes needed for either: {"replacements": [], "boundaryFixes": []}`;

    const parseBase64 = (dataUrl: string) => {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) return { mimeType: match[1], data: match[2] };
      const b64Match = dataUrl.match(/base64,(.+)$/);
      return { mimeType: 'image/png', data: b64Match ? b64Match[1] : dataUrl };
    };

    const orig = parseBase64(originalImage);
    const pix = parseBase64(pixelatedImage);

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
                { type: 'image_url', image_url: { url: `data:${orig.mimeType};base64,${orig.data}` } },
                { type: 'image_url', image_url: { url: `data:${pix.mimeType};base64,${pix.data}` } },
                { type: 'text', text: 'Compare these two images. Image 1 is the original, Image 2 is the pixelated bead version. Provide global replacements and boundary fixes.' },
              ],
            },
          ],
          max_tokens: 800,
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content?.trim() || '{}';
        console.log('颜色分析原始返回:', raw);
        const result = parseAnalysisResult(raw, palette);
        return NextResponse.json(result);
      }
      const errText = await response.text().catch(() => '');
      console.warn('New API 颜色分析失败:', response.status, errText);
    }

    // 回退到 Google Gemini 直连
    const googleApiKey = getEnv('GOOGLE_API_KEY') || getEnv('GEMINI_API_KEY');
    if (!googleApiKey) {
      console.warn('未配置视觉 API，跳过颜色分析');
      return NextResponse.json({ replacements: [], boundaryFixes: [] });
    }

    const model = getEnv('GEMINI_TEXT_MODEL') || 'gemini-2.0-flash-exp';
    const baseUrl = getEnv('GOOGLE_API_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${googleApiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: orig.mimeType, data: orig.data } },
            { inlineData: { mimeType: pix.mimeType, data: pix.data } },
            { text: `${systemPrompt}\n\nCompare these two images. Provide global replacements and boundary fixes.` },
          ],
        }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn('Gemini 颜色分析失败:', err?.error?.message || response.status);
      return NextResponse.json({ replacements: [], boundaryFixes: [] });
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    console.log('Gemini 颜色分析原始返回:', raw);
    const result = parseAnalysisResult(raw, palette);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('analyze-color-mapping error:', e);
    return NextResponse.json({ replacements: [], boundaryFixes: [] });
  }
}

type Replacement = { from: string; to: string; reason: string };

/** 解析并验证 AI 返回的分析结果 */
function parseAnalysisResult(
  raw: string,
  palette: string[]
): { replacements: Replacement[]; boundaryFixes: Replacement[] } {
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const paletteSet = new Set(palette.map((h: string) => h.toUpperCase()));

    const validate = (arr: any[]): Replacement[] =>
      (Array.isArray(arr) ? arr : [])
        .filter(
          (item: any) =>
            item?.from && item?.to &&
            typeof item.from === 'string' && typeof item.to === 'string' &&
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

    // 兼容旧格式（纯数组）
    if (Array.isArray(parsed)) {
      return { replacements: validate(parsed), boundaryFixes: [] };
    }

    return {
      replacements: validate(parsed.replacements),
      boundaryFixes: validate(parsed.boundaryFixes),
    };
  } catch {
    console.warn('解析颜色分析结果失败:', raw);
    return { replacements: [], boundaryFixes: [] };
  }
}
