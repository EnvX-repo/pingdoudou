'use client';

import { useState, useEffect } from 'react';

export default function TestAPIPage() {
  const [status, setStatus] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // 检查服务器端配置
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch('/api/check-config');
        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error('检查配置失败:', error);
        setConfig({ configured: false, error: '无法检查配置' });
      } finally {
        setConfigLoading(false);
      }
    };
    checkConfig();
  }, []);

  const testGoogleAPI = async () => {
    setLoading(true);
    setStatus('正在测试Google Gemini API...');
    setResult(null);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'A simple cute cartoon cat, pixel art style',
          colors: ['#FF0000', '#00FF00', '#0000FF'],
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setStatus('✅ API调用成功！');
        setResult({
          success: true,
          imageUrl: data.imageUrl?.substring(0, 100) + '...',
          fullData: data,
        });
      } else {
        setStatus(data.isNetworkError ? '❌ 网络连接失败' : '❌ API调用失败');
        setResult({
          success: false,
          error: data.error,
          message: data.message,
          details: data.details,
          isNetworkError: data.isNetworkError,
        });
      }
    } catch (error: any) {
      setStatus('❌ 请求失败');
      setResult({
        success: false,
        error: error.message,
        stack: error.stack,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Google Gemini API 测试</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">当前配置</h2>
          {configLoading ? (
            <p className="text-gray-600">正在检查配置...</p>
          ) : config ? (
            <div className="space-y-2 text-sm">
              <p>
                <strong>API Key状态:</strong>{' '}
                <span className={config.configured ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {config.configured ? '✅ 已配置' : '❌ 未配置'}
                </span>
              </p>
              <p><strong>服务类型:</strong> {config.service || 'none'}</p>
              {config.model && <p><strong>模型:</strong> {config.model}</p>}
              {config.configured && (
                <p><strong>Key前缀:</strong> {config.keyPrefix}</p>
              )}
              {!config.configured && (
                <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded">
                  <p className="text-sm">
                    <strong>提示：</strong>请在 <code>.env.local</code> 文件中配置以下环境变量之一：
                  </p>
                  <ul className="list-disc list-inside mt-2 text-xs">
                    <li><code>GOOGLE_API_KEY</code> (Google Gemini)</li>
                    <li><code>OPENAI_API_KEY</code> (OpenAI DALL-E)</li>
                    <li><code>AZURE_OPENAI_API_KEY</code> (Azure OpenAI)</li>
                  </ul>
                </div>
              )}
              <p className="mt-4 text-xs text-gray-500">
                <strong>Endpoint:</strong> /api/generate-image
              </p>
            </div>
          ) : (
            <p className="text-red-600">无法加载配置信息</p>
          )}
        </div>

        <button
          onClick={testGoogleAPI}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {loading ? '测试中...' : '开始测试'}
        </button>

        {status && (
          <div className={`p-4 rounded-lg mb-4 ${
            status.includes('✅') ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
          }`}>
            <p className="font-semibold">{status}</p>
          </div>
        )}

        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">测试结果</h2>
            
            {result.isNetworkError && (
              <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ 网络连接问题</h3>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                  <p><strong>可能的原因：</strong></p>
                  <ul className="list-disc list-inside ml-2">
                    <li>防火墙或网络限制阻止了访问Google API</li>
                    <li>需要配置代理才能访问</li>
                    <li>网络环境限制（某些地区可能无法直接访问）</li>
                    <li>DNS解析问题</li>
                  </ul>
                  <p className="mt-3"><strong>建议解决方案：</strong></p>
                  <ul className="list-disc list-inside ml-2">
                    <li>检查防火墙设置，允许访问 generativelanguage.googleapis.com</li>
                    <li>如果在中国大陆，可能需要使用VPN或代理</li>
                    <li>使用"上传图片"功能（无需API调用，完全免费）</li>
                  </ul>
                  <div className="mt-4">
                    <a 
                      href="/consume-beads" 
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
                    >
                      前往使用上传图片功能 →
                    </a>
                  </div>
                </div>
              </div>
            )}
            
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
            
            {result.success && result.imageUrl && (
              <div className="mt-4">
                <p className="font-semibold mb-2">生成的图像预览：</p>
                <img 
                  src={result.fullData?.imageUrl} 
                  alt="Generated" 
                  className="max-w-full h-auto rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'text-red-600';
                    errorDiv.textContent = '图像加载失败（可能是base64数据过长）';
                    e.currentTarget.parentElement?.appendChild(errorDiv);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
