// 代理配置工具
import { ProxyAgent } from 'undici';

let globalProxyAgent: ProxyAgent | null = null;
let proxyInitialized = false;

/**
 * 初始化代理配置
 * 支持通过环境变量配置代理
 */
export function initProxy() {
  if (proxyInitialized) {
    return globalProxyAgent;
  }
  
  proxyInitialized = true;
  
  // 检查环境变量中的代理配置
  const httpsProxy = process.env.HTTPS_PROXY || 
                     process.env.https_proxy || 
                     process.env.HTTP_PROXY || 
                     process.env.http_proxy;
  
  if (httpsProxy) {
    try {
      globalProxyAgent = new ProxyAgent(httpsProxy);
      console.log('✅ 代理配置成功:', httpsProxy);
      return globalProxyAgent;
    } catch (error: any) {
      console.error('❌ 代理配置失败:', error?.message || error);
      return null;
    }
  } else {
    console.log('ℹ️ 未配置代理，将直接连接');
  }
  
  return null;
}

/**
 * 获取代理Agent（如果已配置）
 */
export function getProxyAgent(): ProxyAgent | undefined {
  if (!proxyInitialized) {
    initProxy();
  }
  return globalProxyAgent || undefined;
}
