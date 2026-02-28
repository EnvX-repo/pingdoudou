import { config } from 'dotenv';
import { resolve } from 'path';

let lastLoadTime = 0;
const CACHE_TTL = 1000; // 1秒缓存，避免频繁IO

/**
 * 热重载环境变量 - 每次调用都会重新读取 .env 文件
 * 无需重启服务即可生效
 */
export function reloadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  config({ path: envPath, override: true });
  lastLoadTime = Date.now();
}

/**
 * 获取环境变量（自动热重载，带1秒缓存）
 * @param key 环境变量名
 * @returns 环境变量值，不存在则返回 undefined
 */
export function getEnv(key: string): string | undefined {
  const now = Date.now();
  if (now - lastLoadTime > CACHE_TTL) {
    reloadEnv();
  }
  return process.env[key];
}

/**
 * 获取多个环境变量（一次性重载，减少 IO）
 * @param keys 环境变量名数组
 * @returns 环境变量键值对对象
 */
export function getEnvMultiple(keys: string[]): Record<string, string | undefined> {
  reloadEnv();
  const result: Record<string, string | undefined> = {};
  for (const key of keys) {
    result[key] = process.env[key];
  }
  return result;
}
