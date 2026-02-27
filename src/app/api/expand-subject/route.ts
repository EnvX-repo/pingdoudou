import { NextRequest, NextResponse } from 'next/server';
import { getProxyAgent } from '../../../utils/proxy';

/**
 * 把用户输入的简称/昵称/中文名「解释」成清晰的英文描述，方便后续画图。
 * 例如：小八 -> Hachiko the dog from 忠犬八公；凯蒂猫 -> Hello Kitty
 * 使用 Gemini 文本模型，不生成图，只返回一段描述。
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
        { error: '未配置 GOOGLE_API_KEY，无法使用「解释再画」' },
        { status: 500 }
      );
    }

    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp';
    const baseUrl = process.env.GOOGLE_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a helper for a perler bead (拼豆) image generator. The user will send a short phrase: a nickname, a Chinese name, series name + character name, or a casual term for a character, animal, or object. 

First, search the web to find accurate information about what the user is referring to. Then output ONE short sentence in English that describes exactly what to draw, so that an image model can draw it correctly.

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

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nUser input: ${q}` }] }],
        tools: [
          {
            googleSearchRetrieval: {} // 启用 Google Search 联网搜索
          }
        ],
        generationConfig: {
          maxOutputTokens: 200, // 增加token数，因为搜索可能返回更多信息
          temperature: 0.3,
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
    console.log('Gemini expand-subject 响应:', JSON.stringify(data).substring(0, 500));
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!text) {
      console.error('模型未返回描述，原始响应:', JSON.stringify(data));
      return NextResponse.json(
        { error: '模型未返回描述', expanded: q },
        { status: 502 }
      );
    }
    console.log(`解释成功: "${q}" → "${text}"`);

    return NextResponse.json({ expanded: text });
  } catch (e: any) {
    console.error('expand-subject error:', e);
    return NextResponse.json(
      { error: e?.message || '解释失败' },
      { status: 500 }
    );
  }
}
