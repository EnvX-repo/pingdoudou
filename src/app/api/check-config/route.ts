import { NextResponse } from 'next/server';

// 检查API配置状态（不暴露敏感信息）
export async function GET() {
  const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const apiKey = googleApiKey || process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;
  const apiService = process.env.IMAGE_GENERATION_SERVICE || 'openai';
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  
  // 检测服务类型
  let detectedService = 'none';
  if (googleApiKey) {
    detectedService = 'google';
  } else if (process.env.AZURE_OPENAI_API_KEY) {
    detectedService = 'azure';
  } else if (process.env.OPENAI_API_KEY) {
    detectedService = 'openai';
  } else if (process.env.STABLE_DIFFUSION_API_KEY) {
    detectedService = 'stable-diffusion';
  }

  return NextResponse.json({
    configured: !!apiKey,
    service: detectedService,
    hasGoogleKey: !!googleApiKey,
    model: detectedService === 'google' ? model : undefined,
    keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
  });
}
