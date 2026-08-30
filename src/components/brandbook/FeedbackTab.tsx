import { useState } from 'react';
import { Info, Check, AlertTriangle, XCircle, Bell, X, Search, Lock, Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { SectionHeader, GlowCard } from './shared';

export default function FeedbackTab() {
  const [toasts, setToasts] = useState([true, true, true, true]);
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <div className="space-y-32">
      {/* 01 Alerts */}
      <section>
        <SectionHeader num="01" title="Alerts" subtitle="4 semantic alert types — info, success, warning, error" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { variant: 'default' as const, icon: Info, title: 'Information', desc: 'This is an informational alert for general notices.', color: '#3B82F6' },
            { variant: 'default' as const, icon: Check, title: 'Success', desc: 'Operation completed successfully.', color: '#00D26A' },
            { variant: 'default' as const, icon: AlertTriangle, title: 'Warning', desc: 'Please review before continuing.', color: '#F59E0B' },
            { variant: 'destructive' as const, icon: XCircle, title: 'Error', desc: 'Something went wrong. Please try again.', color: '#EF4444' },
          ].map(({ variant, icon: Icon, title, desc, color }) => (
            <Alert key={title} variant={variant} className="rounded-[2px] bg-white/[0.02] border-white/[0.06]" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <Icon className="h-4 w-4" style={{ color }} />
              <AlertTitle className="text-[12px] text-white/60">{title}</AlertTitle>
              <AlertDescription className="text-[10px] text-white/35">{desc}</AlertDescription>
            </Alert>
          ))}
        </div>
      </section>

      {/* 02 Toasts */}
      <section>
        <SectionHeader num="02" title="Toasts" subtitle="Temporary notifications — auto-dismiss with close action" />
        <div className="space-y-3">
          {[
            { msg: 'Changes saved', type: 'success', color: '#00D26A', icon: Check },
            { msg: 'Connection failed', type: 'error', color: '#EF4444', icon: XCircle },
            { msg: 'Storage 92% full', type: 'warning', color: '#F59E0B', icon: AlertTriangle },
            { msg: 'Update available', type: 'info', color: '#3B82F6', icon: Info },
          ].map(({ msg, type, color, icon: Icon }, i) => toasts[i] && (
            <div key={msg} className="flex items-center justify-between p-3 rounded-[2px] border bg-white/[0.02]" style={{ borderColor: `${color}30` }}>
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-[11px] text-white/60">{msg}</span>
              </div>
              <button onClick={() => setToasts(t => { const n = [...t]; n[i] = false; return n; })} className="text-white/20 hover:text-white/40">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 03 Empty States */}
      <section>
        <SectionHeader num="03" title="Empty States" subtitle="4 configurations — default, search, error, permissions" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { title: 'Nenhum item', desc: 'Crie o primeiro item para começar', icon: '📦', action: 'Criar item', color: '#3B82F6' },
            { title: 'Sem resultados', desc: 'Tente refinar sua busca', icon: '🔍', action: 'Limpar busca', color: '#F59E0B' },
            { title: 'Algo deu errado', desc: 'Erro ao carregar dados', icon: '⚠️', action: 'Tentar novamente', color: '#EF4444' },
            { title: 'Acesso restrito', desc: 'Sem permissão para este recurso', icon: '🔒', action: 'Solicitar acesso', color: '#6C16F8' },
          ].map(({ title, desc, icon, action, color }) => (
            <GlowCard key={title} glow={color}>
              <div className="text-center py-6">
                <span className="text-[32px] mb-3 block">{icon}</span>
                <p className="text-[12px] font-medium text-white/50 mb-1">{title}</p>
                <p className="text-[10px] text-white/25 mb-4">{desc}</p>
                <button className="h-[26px] px-3 rounded-[2px] text-[9px] font-mono text-white/40 border border-white/[0.08] hover:border-white/[0.15] transition-all">
                  {action}
                </button>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 04 Loading Overlay */}
      <section>
        <SectionHeader num="04" title="Loading Overlay" subtitle="Spinner display — SM, MD, LG sizes with overlay" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlowCard glow="#FF4400">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Spinner Sizes</h3>
            <div className="flex items-center justify-center gap-10 py-6">
              {(['sm', 'md', 'lg'] as const).map((size) => (
                <div key={size} className="flex flex-col items-center gap-3">
                  <LoadingSpinner size={size} />
                  <span className="text-[9px] font-mono text-white/20 uppercase">{size}</span>
                </div>
              ))}
            </div>
          </GlowCard>
          <GlowCard glow="#3B82F6">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Overlay</h3>
            <div className="relative h-40 rounded-[2px] bg-white/[0.02] border border-white/[0.04] overflow-hidden">
              <div className="p-4">
                <div className="h-3 w-3/4 rounded bg-white/[0.04] mb-2" />
                <div className="h-3 w-1/2 rounded bg-white/[0.04] mb-2" />
                <div className="h-3 w-2/3 rounded bg-white/[0.04]" />
              </div>
              {showOverlay && (
                <div className="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm flex items-center justify-center">
                  <LoadingSpinner size="md" message="Loading..." />
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-[26px] mt-3 rounded-[2px] text-[9px]"
              onClick={() => { setShowOverlay(true); setTimeout(() => setShowOverlay(false), 3000); }}
            >
              Trigger 3s overlay
            </Button>
          </GlowCard>
        </div>
      </section>

      {/* 05 Notification Center */}
      <section>
        <SectionHeader num="05" title="Notification Center" subtitle="Bell icon with unread count badge" />
        <GlowCard glow="#EC4899">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Bell className="w-5 h-5 text-white/40" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#FF4400] flex items-center justify-center text-[7px] font-bold text-white">2</span>
            </div>
            <span className="text-[10px] text-white/25">Clique no sino para abrir o painel de notificações</span>
          </div>
        </GlowCard>
      </section>

      {/* 06 Confirm Sheet */}
      <section>
        <SectionHeader num="06" title="Confirm Sheet" subtitle="3 variants — default, destructive, loading" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'Confirm Action', desc: 'Are you sure you want to proceed?', action: 'Confirm', variant: 'default', color: '#3B82F6' },
            { title: 'Delete Item', desc: 'This action cannot be undone.', action: 'Delete', variant: 'destructive', color: '#EF4444' },
            { title: 'Processing...', desc: 'Please wait while we save.', action: 'Saving...', variant: 'loading', color: '#F59E0B' },
          ].map(({ title, desc, action, variant, color }) => (
            <GlowCard key={variant} glow={color}>
              <div className="p-4 rounded-[2px] bg-white/[0.02] border border-white/[0.06]">
                <h4 className="text-[12px] font-semibold text-white/60 mb-1">{title}</h4>
                <p className="text-[10px] text-white/30 mb-4">{desc}</p>
                <div className="flex gap-2">
                  <button className="h-[26px] px-3 rounded-[2px] text-[9px] text-white/30 border border-white/[0.06]">Cancel</button>
                  <button className="h-[26px] px-3 rounded-[2px] text-[9px] text-white font-medium flex items-center gap-1" style={{ backgroundColor: color }}>
                    {variant === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {action}
                  </button>
                </div>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>
    </div>
  );
}
