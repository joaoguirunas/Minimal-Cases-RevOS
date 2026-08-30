import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUnifiedSessionManager } from '@/hooks/useUnifiedSessionManager';
import { Activity, Wifi, Database, Clock, RefreshCw } from 'lucide-react';

interface PerformanceStats {
  memoryUsage: number;
  renderCount: number;
  lastActivity: Date;
  sessionHealth: 'good' | 'warning' | 'critical';
  realtimeHealth: 'connected' | 'disconnected' | 'recovering';
}

const POSITION_STORAGE_KEY = 'perf-monitor-position';

interface Position {
  x: number;
  y: number;
}

function loadSavedPosition(): Position | null {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed;
  } catch {
    // ignore — localStorage indisponível ou lixo salvo
  }
  return null;
}

function saveSavedPosition(pos: Position) {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

export const PerformanceMonitor: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats>({
    memoryUsage: 0,
    renderCount: 0,
    lastActivity: new Date(),
    sessionHealth: 'good',
    realtimeHealth: 'connected'
  });

  const [isVisible, setIsVisible] = useState(false);

  // Posição arrastável — null = usa o canto padrão (bottom-4 right-4) até o
  // usuário arrastar pela primeira vez; depois disso fica salva em localStorage
  // (o botão às vezes cobre elementos importantes da tela, daí a necessidade
  // de poder movê-lo e persistir a escolha).
  const [position, setPosition] = useState<Position | null>(() => loadSavedPosition());
  const containerRef = useRef<HTMLDivElement>(null);
  const wasDraggingRef = useRef(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragging: boolean;
    lastPos: Position | null;
  } | null>(null);

  const clampPosition = (x: number, y: number): Position => {
    const el = containerRef.current;
    const width = el?.offsetWidth ?? 40;
    const height = el?.offsetHeight ?? 40;
    const maxX = Math.max(window.innerWidth - width - 8, 8);
    const maxY = Math.max(window.innerHeight - height - 8, 8);
    return { x: Math.min(Math.max(x, 8), maxX), y: Math.min(Math.max(y, 8), maxY) };
  };

  const onPointerMove = (e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.dragging && Math.hypot(dx, dy) < 4) return;
    drag.dragging = true;
    const next = clampPosition(drag.originX + dx, drag.originY + dy);
    drag.lastPos = next;
    setPosition(next);
  };

  const onPointerUp = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    const drag = dragRef.current;
    wasDraggingRef.current = drag?.dragging ?? false;
    if (drag?.dragging && drag.lastPos) {
      saveSavedPosition(drag.lastPos);
    }
    dragRef.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return; // só botão esquerdo/touch
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: rect.left, originY: rect.top, dragging: false, lastPos: null };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Ao expandir/recolher o card, o tamanho muda — reclampa pra não deixar o
  // painel aberto vazando pra fora da tela quando a posição salva estava
  // perto de uma borda no estado colapsado.
  useEffect(() => {
    if (!position) return;
    const next = clampPosition(position.x, position.y);
    if (next.x !== position.x || next.y !== position.y) setPosition(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  useEffect(() => {
    if (!position) return;
    const handleResize = () => setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : prev));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!position]);

  const handleToggleVisible = () => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    setIsVisible((v) => !v);
  };

  const { 
    isConnected: sessionConnected, 
    sessionValid, 
    minutesLeft, 
    retryAttempts: sessionRetries 
  } = useUnifiedSessionManager();
  
  
  
  // Valores padrão para realtime (removido useRealtimeRecovery)
  const realtimeConnected = false;
  const realtimeRetries = 0;
  const forceReconnect = () => {};

  // Contador de renders
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  // Atualizar estatísticas
  useEffect(() => {
    const updateStats = () => {
      // Calcular uso de memória (aproximado)
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Determinar saúde da sessão
      let sessionHealth: 'good' | 'warning' | 'critical' = 'good';
      if (!sessionConnected || !sessionValid) {
        sessionHealth = 'critical';
      } else if (minutesLeft !== null && minutesLeft <= 15) {
        sessionHealth = 'warning';
      }

      // Determinar saúde do realtime
      let realtimeHealth: 'connected' | 'disconnected' | 'recovering' = 'connected';
      if (!realtimeConnected) {
        realtimeHealth = realtimeRetries > 0 ? 'recovering' : 'disconnected';
      }

      setStats({
        memoryUsage: Math.round(memoryUsage / 1024 / 1024), // MB
        renderCount: renderCountRef.current,
        lastActivity: new Date(),
        sessionHealth,
        realtimeHealth
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // A cada 5 segundos

    return () => clearInterval(interval);
  }, [sessionConnected, sessionValid, minutesLeft, realtimeConnected, realtimeRetries]);

  // Mostrar monitor apenas no desenvolvimento ou com Ctrl+Shift+P
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(!isVisible);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  // Mostrar apenas se visível
  if (!isVisible && process.env.NODE_ENV === 'production') {
    return null;
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'good':
      case 'connected':
        return 'bg-green-500';
      case 'warning':
      case 'recovering':
        return 'bg-yellow-500';
      case 'critical':
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getHealthText = (health: string) => {
    switch (health) {
      case 'good':
        return 'Saudável';
      case 'warning':
        return 'Atenção';
      case 'critical':
        return 'Crítico';
      case 'connected':
        return 'Conectado';
      case 'recovering':
        return 'Recuperando';
      case 'disconnected':
        return 'Desconectado';
      default:
        return health;
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      className={position ? 'fixed z-50 cursor-grab active:cursor-grabbing touch-none' : 'fixed bottom-4 right-4 z-50 cursor-grab active:cursor-grabbing touch-none'}
      style={position ? { left: position.x, top: position.y } : undefined}
      title="Arraste para mover"
    >
      {!isVisible ? (
        <Button
          size="sm"
          variant="outline"
          onClick={handleToggleVisible}
          className="bg-background border-border"
        >
          <Activity className="w-4 h-4" />
        </Button>
      ) : (
        <Card className="w-80 bg-background border-border shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Performance Monitor</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsVisible(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Saúde da Sessão */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Sessão</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`${getHealthColor(stats.sessionHealth)} text-white border-none`}
                >
                  {getHealthText(stats.sessionHealth)}
                </Badge>
                {minutesLeft && (
                  <span className="text-xs text-muted-foreground">
                    {minutesLeft}m
                  </span>
                )}
              </div>
            </div>

            {/* Saúde do Realtime */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Realtime</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`${getHealthColor(stats.realtimeHealth)} text-white border-none`}
                >
                  {getHealthText(stats.realtimeHealth)}
                </Badge>
                {realtimeRetries > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={forceReconnect}
                    className="h-6 w-6 p-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Tentativas de Reconexão */}
            {(sessionRetries > 0 || realtimeRetries > 0) && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Tentativas</span>
                <div className="flex gap-2">
                  {sessionRetries > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Sessão: {sessionRetries}
                    </Badge>
                  )}
                  {realtimeRetries > 0 && (
                    <Badge variant="outline" className="text-xs">
                      RT: {realtimeRetries}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Estatísticas de Performance */}
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Memória</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {stats.memoryUsage} MB
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Renders</span>
                <span className="text-xs text-muted-foreground">
                  {stats.renderCount}
                </span>
              </div>
            </div>

            {/* Informações do Tenant */}
            {true && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Tenant: {'single-tenant'.slice(0, 8)}...
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground text-center">
              Ctrl+Shift+P para alternar
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};