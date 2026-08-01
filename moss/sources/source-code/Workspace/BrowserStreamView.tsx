/**
 * 浏览器流预览组件
 * 
 * 通过 WebSocket 连接到 agent-browser 的流式传输端口，
 * 实时显示浏览器画面并支持鼠标/键盘交互
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Globe, Loader2, AlertCircle, RefreshCw, MousePointer2, Maximize2, Minimize2 } from 'lucide-react';

interface BrowserStreamViewProps {
  port?: number;        // agent-browser 技能的流端口
  url?: string;
  sessionId?: string;   // 内置 browser 工具的会话 ID
  onUrlChange?: (url: string) => void;
}

interface FrameMetadata {
  deviceWidth: number;
  deviceHeight: number;
  pageScaleFactor: number;
  offsetTop: number;
  scrollOffsetX: number;
  scrollOffsetY: number;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export const BrowserStreamView: React.FC<BrowserStreamViewProps> = ({
  port,
  url,
  sessionId,
  onUrlChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [metadata, setMetadata] = useState<FrameMetadata | null>(null);
  const [interactionEnabled, setInteractionEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 20;

  // 清理重连定时器
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // 判断连接模式：agent-browser (有 port) 或 内置 browser (有 sessionId)
  const isBuiltinBrowser = !port && !!sessionId;
  
  // 连接 WebSocket
  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    // 关闭旧连接
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setStatus('connecting');
    setErrorMessage('');
    
    // 根据模式选择不同的 WebSocket 端点
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    let wsUrl: string;
    if (isBuiltinBrowser && sessionId) {
      wsUrl = `${wsProtocol}//${wsHost}/ws/browser-screencast/${sessionId}`;
      console.log(`[BrowserStream] Connecting to builtin browser screencast: ${wsUrl} (attempt ${retryCountRef.current + 1})`);
    } else if (port) {
      wsUrl = `${wsProtocol}//${wsHost}/ws/browser-stream/${port}`;
      console.log(`[BrowserStream] Connecting via proxy to ${wsUrl} (attempt ${retryCountRef.current + 1})`);
    } else {
      setStatus('error');
      setErrorMessage('缺少连接参数 (port 或 sessionId)');
      return;
    }
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        console.log('[BrowserStream] Connected!');
        setStatus('connected');
        retryCountRef.current = 0;
        
        // 启用 screencasting（两种模式都需要发送此命令）
        console.log('[BrowserStream] Enabling screencasting...');
        ws.send(JSON.stringify({ type: 'enable_screencasting' }));
      };
      
      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'status') {
            // 状态消息 - 包含视口信息
            console.log('[BrowserStream] Status:', message);
            if (message.viewportWidth && message.viewportHeight) {
              setMetadata(prev => ({
                ...prev,
                deviceWidth: message.viewportWidth,
                deviceHeight: message.viewportHeight,
                pageScaleFactor: 1,
                offsetTop: 0,
                scrollOffsetX: 0,
                scrollOffsetY: 0,
              } as FrameMetadata));
            }
          } else if (message.type === 'frame') {
            // 帧数据
            const canvas = canvasRef.current;
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            const img = new Image();
            img.onload = () => {
              if (!mountedRef.current) return;
              
              // 更新 canvas 尺寸
              if (message.metadata) {
                const { deviceWidth, deviceHeight } = message.metadata;
                if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
                  canvas.width = deviceWidth;
                  canvas.height = deviceHeight;
                }
                setMetadata(message.metadata);
              }
              
              ctx.drawImage(img, 0, 0);
              setFrameCount(prev => prev + 1);
            };
            img.onerror = () => {
              console.error('[BrowserStream] Failed to load frame image');
            };
            img.src = `data:image/jpeg;base64,${message.data}`;
          } else if (message.type === 'url') {
            onUrlChange?.(message.url);
          }
        } catch (e) {
          console.error('[BrowserStream] Failed to parse message:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[BrowserStream] WebSocket error:', error);
      };
      
      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        
        console.log('[BrowserStream] Connection closed, code:', event.code);
        wsRef.current = null;
        setStatus('disconnected');
        
        // 自动重连
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const delay = Math.min(1000 * retryCountRef.current, 5000);
          console.log(`[BrowserStream] Reconnecting in ${delay}ms...`);
          
          clearReconnectTimeout();
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);
        } else {
          setStatus('error');
          setErrorMessage('连接失败，已达到最大重试次数');
        }
      };
    } catch (e) {
      console.error('[BrowserStream] Failed to create WebSocket:', e);
      setStatus('error');
      setErrorMessage('无法创建 WebSocket 连接');
    }
  }, [port, sessionId, isBuiltinBrowser, onUrlChange, clearReconnectTimeout]);

  // 手动重连
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  // 发送输入事件
  const sendInput = useCallback((event: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  // 计算鼠标在画布上的相对位置
  const getCanvasPosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !metadata) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = metadata.deviceWidth / rect.width;
    const scaleY = metadata.deviceHeight / rect.height;
    
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }, [metadata]);

  // 鼠标事件处理
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactionEnabled) return;
    const pos = getCanvasPosition(e);
    if (!pos) return;
    
    sendInput({
      type: 'input_mouse',
      eventType: 'mouseMoved',
      x: pos.x,
      y: pos.y,
    });
  }, [interactionEnabled, getCanvasPosition, sendInput]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactionEnabled) return;
    const pos = getCanvasPosition(e);
    if (!pos) return;
    
    sendInput({
      type: 'input_mouse',
      eventType: 'mousePressed',
      x: pos.x,
      y: pos.y,
      button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle',
      clickCount: 1,
    });
  }, [interactionEnabled, getCanvasPosition, sendInput]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactionEnabled) return;
    const pos = getCanvasPosition(e);
    if (!pos) return;
    
    sendInput({
      type: 'input_mouse',
      eventType: 'mouseReleased',
      x: pos.x,
      y: pos.y,
      button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle',
      clickCount: 1,
    });
  }, [interactionEnabled, getCanvasPosition, sendInput]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!interactionEnabled) return;
    const pos = getCanvasPosition(e as unknown as React.MouseEvent<HTMLCanvasElement>);
    if (!pos) return;
    
    sendInput({
      type: 'input_mouse',
      eventType: 'mouseWheel',
      x: pos.x,
      y: pos.y,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
  }, [interactionEnabled, getCanvasPosition, sendInput]);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!interactionEnabled) return;
    e.preventDefault();
    
    sendInput({
      type: 'input_keyboard',
      eventType: 'keyDown',
      key: e.key,
      code: e.code,
      modifiers: {
        alt: e.altKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
      },
    });
  }, [interactionEnabled, sendInput]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!interactionEnabled) return;
    e.preventDefault();
    
    sendInput({
      type: 'input_keyboard',
      eventType: 'keyUp',
      key: e.key,
      code: e.code,
    });
  }, [interactionEnabled, sendInput]);

  // 初始化连接
  useEffect(() => {
    mountedRef.current = true;
    
    // 延迟一点再连接，确保流式服务器已启动
    const timer = window.setTimeout(() => {
      connect();
    }, 500);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, clearReconnectTimeout]);

  // 状态指示器
  const StatusIndicator = () => {
    switch (status) {
      case 'connecting':
        return (
          <div className="flex items-center gap-2 text-yellow-500" data-testid="browser-stream-view-status">
            <Loader2 size={14} className="animate-spin" />
            <span>连接中...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-green-500" data-testid="browser-stream-view-status">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>已连接</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center gap-2 text-zinc-500" data-testid="browser-stream-view-status">
            <div className="w-2 h-2 rounded-full bg-zinc-500" />
            <span>已断开</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-500" data-testid="browser-stream-view-status">
            <AlertCircle size={14} />
            <span>连接错误</span>
          </div>
        );
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full bg-[var(--bg-primary)]"
      data-testid="browser-stream-view"
    >
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]" data-testid="browser-stream-view-toolbar">
        <div className="flex items-center gap-3">
          <Globe size={16} className="text-cyan-500" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            浏览器预览
          </span>
          {url && (
            <span className="text-xs text-[var(--text-secondary)] truncate max-w-[300px]">
              {url}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <StatusIndicator />
          
          {/* 交互开关 */}
          <button
            onClick={() => setInteractionEnabled(!interactionEnabled)}
            data-testid="browser-stream-view-interaction-toggle"
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors
              ${interactionEnabled 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
              }
            `}
            title={interactionEnabled ? '禁用交互' : '启用交互'}
          >
            <MousePointer2 size={12} />
            {interactionEnabled ? '交互中' : '交互'}
          </button>
          
          {/* 重连按钮 */}
          <button
            onClick={reconnect}
            data-testid="browser-stream-view-reconnect"
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="重新连接"
          >
            <RefreshCw size={14} />
          </button>
          
          {/* 全屏按钮 */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            data-testid="browser-stream-view-fullscreen"
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={isFullscreen ? '退出全屏' : '全屏'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      
      {/* 画面区域 - 保持原始宽高比等比缩放 */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-3 bg-zinc-900 relative" data-testid="browser-stream-view-stage">
        {status === 'connecting' && frameCount === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500 z-10" data-testid="browser-stream-view-loading">
            <Loader2 size={32} className="animate-spin" />
            <span>正在连接到浏览器...</span>
            <span className="text-xs text-zinc-600">
              {isBuiltinBrowser ? '内置浏览器' : `端口: ${port}`}
            </span>
          </div>
        )}
        
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500 z-10" data-testid="browser-stream-view-error">
            <AlertCircle size={32} className="text-red-500" />
            <span className="text-red-400">{errorMessage}</span>
            <button
              onClick={reconnect}
              data-testid="browser-stream-view-error-retry"
              className="flex items-center gap-2 px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              <RefreshCw size={14} />
              重试
            </button>
          </div>
        )}
        
        {/* 
          Canvas 等比缩放策略：
          - canvas 的 width/height 属性 = 原始分辨率（用于绘制）
          - CSS 使用 object-fit: contain 保持宽高比
          - 外层容器限制最大尺寸
        */}
        <canvas
          ref={canvasRef}
          data-testid="browser-stream-view-canvas"
          className={`
            rounded shadow-lg
            ${interactionEnabled ? 'cursor-crosshair' : 'cursor-default'}
            ${status === 'connected' && frameCount > 0 ? 'opacity-100' : 'opacity-30'}
          `}
          style={{
            backgroundColor: '#1a1a1a',
            // 保持宽高比，在容器内等比缩放
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            // 固定原始比例：16:9 (1280x720)
            aspectRatio: `${metadata?.deviceWidth || 1280} / ${metadata?.deviceHeight || 720}`,
            objectFit: 'contain',
          }}
          // canvas 原始分辨率（用于绘制，不影响显示大小）
          width={metadata?.deviceWidth || 1280}
          height={metadata?.deviceHeight || 720}
          tabIndex={interactionEnabled ? 0 : -1}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onContextMenu={(e) => interactionEnabled && e.preventDefault()}
        />
      </div>
      
      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)]" data-testid="browser-stream-view-footer">
        <span>
          {metadata ? `${metadata.deviceWidth} × ${metadata.deviceHeight}` : '1280 × 720'}
        </span>
        {sessionId && (
          <span className="text-zinc-600">
            会话: {sessionId}
          </span>
        )}
        <span className="text-zinc-600">
          帧数: {frameCount}
        </span>
      </div>
    </div>
  );
};

export default BrowserStreamView;
