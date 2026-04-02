import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '../../../utils/hotEnv';

/**
 * 把用户输入的简称/昵称/中文名「解释」成清晰的英文描述，方便后续画图。
 * 例如：小八 -> Hachiko the dog from 忠犬八公；凯蒂猫 -> Hello Kitty
 * 优先使用 New API 网关（OpenAI 兼容），回退到 Google Gemini 直连。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;
    const q = typeof query === 'string' ? query.trim() : '';
    if (!q) {
      return NextResponse.json({ error: '缺少 query 参数' }, { status: 400 });
    }

    const systemPrompt = `You are a helper for a perler bead (拼豆) image generator. The user will send a short phrase: a nickname, a Chinese name, series name + character name, or a casual term for a character, animal, or object.

First, identify what the user is referring to. Then output ONE short sentence in English that describes exactly what to draw, so that an image model can draw it correctly.

Examples:
- 小八 → ハチ (Hachi), the cute cat from Chiikawa (ちいかわ), 哈奇猫, round face and simple design, single subject
- chiikawa小八 → ハチ (Hachi), the cute cat from Chiikawa (ちいかわ), 哈奇猫, round face and simple design, single subject
- chiikawa → ちいかわ (Chiikawa), the cute small animal characters from Chiikawa anime, simple round design, single subject
- 凯蒂猫 → Hello Kitty, the white cat with a red bow, single subject
- 蜡笔小新 → Crayon Shin-chan (クレヨンしんちゃん), the Japanese cartoon boy with thick eyebrows, single subject
- 皮卡丘 → Pikachu the yellow Pokémon, single subject
- 草莓蛋糕 → a cute strawberry shortcake, single subject

Rules:
- If the input contains both a series name (like "chiikawa", "ちいかわ") and a character name (like "小八", "ハチ"), identify the specific character from that series.
- Output ONLY the one English description sentence. No quotes, no "Description:", no explanation.
- Be specific so the image is recognizable (e.g. "Hachi from Chiikawa" not just "a cat").
- End with "single subject" to keep the image clean.`;

    // 优先用 New API 网关（OpenAI 兼容格式）
    const openaiKey = getEnv('OPENAI_API_KEY');
    const openRouterBase = getEnv('OPENROUTER_BASE_URL');

    if (openaiKey && openRouterBase) {
      const endpoint = `${openRouterBase.replace(/\/$/, '')}/chat/completions`;
      const model = getEnv('OPENROUTER_TEXT_MODEL') || 'gpt-4.1-mini';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: q },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content?.trim() || '';
        if (text) {
          console.log(`解释成功(New API): "${q}" → "${text}"`);
          return NextResponse.json({ expanded: text });
        }
      }
      console.warn('New API 调用失败，尝试回退到 Gemini 直连');
    }

    // 回退到 Google Gemini 直连
    const googleApiKey = getEnv('GOOGLE_API_KEY') || getEnv('GEMINI_API_KEY');
    if (!googleApiKey) {
      // 没有任何可用的 API，返回原文
      console.warn('未配置任何文本 API，返回原文');
      return NextResponse.json({ expanded: q });
    }

    const model = getEnv('GEMINI_TEXT_MODEL') || 'gemini-2.0-flash-exp';
    const baseUrl = getEnv('GOOGLE_API_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${googleApiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nUser input: ${q}` }] }],
        tools: [{ googleSearchRetrieval: {} }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${response.status}`;
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!text) {
      return NextResponse.json({ error: '模型未返回描述', expanded: q }, { status: 502 });
    }
    console.log(`解释成功(Gemini): "${q}" → "${text}"`);
    return NextResponse.json({ expanded: text });
  } catch (e: any) {
    console.error('expand-subject error:', e);
    return NextResponse.json({ error: e?.message || '解释失败' }, { status: 500 });
  }
}
