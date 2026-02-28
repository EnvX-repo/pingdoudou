import { NextResponse } from 'next/server';
import { getEnv } from '../../../utils/hotEnv';

// 检查API配置状态（不暴露敏感信息）
export async function GET() {
  const googleApiKey = getEnv('GOOGLE_API_KEY') || getEnv('GEMINI_API_KEY');
  const apiKey = googleApiKey || getEnv('AZURE_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY') || getEnv('STABLE_DIFFUSION_API_KEY');
  const apiService = getEnv('IMAGE_GENERATION_SERVICE') || 'openai';
  const model = getEnv('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image';
  
  // 检测服务类型
  let detectedService = 'none';
  if (googleApiKey) {
    detectedService = 'google';
  } else if (getEnv('AZURE_OPENAI_API_KEY')) {
    detectedService = 'azure';
  } else if (getEnv('OPENAI_API_KEY')) {
    detectedService = 'openai';
  } else if (getEnv('STABLE_DIFFUSION_API_KEY')) {
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
