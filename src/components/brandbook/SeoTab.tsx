import { Globe, Share2, Code2 } from 'lucide-react';
import { SectionHeader, GlowCard } from './shared';

export default function SeoTab() {
  return (
    <div className="space-y-32">
      {/* 01 Meta Tags */}
      <section>
        <SectionHeader num="01" title="Meta Tags" subtitle="HTML head metadata — title, description, robots, canonical" />
        <GlowCard glow="#FF4400">
          <div className="rounded-[2px] bg-[#050505] border border-white/[0.06] p-5 font-mono text-[10px] space-y-2">
            <p className="text-white/20">{'<!-- Primary Meta Tags -->'}</p>
            <p><span className="text-[#FF4400]/50">{'<title>'}</span><span className="text-white/50">João Guirunas CRM</span><span className="text-[#FF4400]/50">{'</title>'}</span></p>
            <p><span className="text-[#FF4400]/50">{'<meta'}</span> <span className="text-[#3B82F6]/50">name=</span><span className="text-[#00D26A]/50">"description"</span> <span className="text-[#3B82F6]/50">content=</span><span className="text-[#00D26A]/50">"CRM inteligente com automação, pipelines e analytics"</span><span className="text-[#FF4400]/50">{' />'}</span></p>
            <p><span className="text-[#FF4400]/50">{'<meta'}</span> <span className="text-[#3B82F6]/50">name=</span><span className="text-[#00D26A]/50">"robots"</span> <span className="text-[#3B82F6]/50">content=</span><span className="text-[#00D26A]/50">"index, follow"</span><span className="text-[#FF4400]/50">{' />'}</span></p>
            <p><span className="text-[#FF4400]/50">{'<link'}</span> <span className="text-[#3B82F6]/50">rel=</span><span className="text-[#00D26A]/50">"canonical"</span> <span className="text-[#3B82F6]/50">href=</span><span className="text-[#00D26A]/50">"https://app.revos.com.br"</span><span className="text-[#FF4400]/50">{' />'}</span></p>
          </div>
          <div className="mt-4 flex gap-4">
            <div className="p-2 rounded-[2px] bg-white/[0.02] border border-white/[0.04]">
              <p className="text-[9px] font-mono text-white/25">Title: max 60 chars</p>
            </div>
            <div className="p-2 rounded-[2px] bg-white/[0.02] border border-white/[0.04]">
              <p className="text-[9px] font-mono text-white/25">Description: max 155 chars</p>
            </div>
          </div>
        </GlowCard>
      </section>

      {/* 02 Open Graph */}
      <section>
        <SectionHeader num="02" title="Open Graph" subtitle="Social sharing protocol — Facebook, LinkedIn, WhatsApp" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlowCard glow="#3B82F6">
            <div className="flex items-center gap-2 mb-4">
              <Share2 className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="text-[10px] font-mono text-white/30 uppercase tracking-[0.08em]">OG Properties</h3>
            </div>
            <div className="rounded-[2px] bg-[#050505] border border-white/[0.06] p-4 font-mono text-[10px] space-y-1.5">
              <p><span className="text-[#3B82F6]/50">og:title</span> <span className="text-white/30">= "João Guirunas CRM"</span></p>
              <p><span className="text-[#3B82F6]/50">og:description</span> <span className="text-white/30">= "CRM inteligente"</span></p>
              <p><span className="text-[#3B82F6]/50">og:type</span> <span className="text-white/30">= "website"</span></p>
              <p><span className="text-[#3B82F6]/50">og:image</span> <span className="text-white/30">= "/og-image.png"</span></p>
              <p><span className="text-[#3B82F6]/50">og:url</span> <span className="text-white/30">= "https://app.revos.com.br"</span></p>
            </div>
          </GlowCard>
          <GlowCard glow="#FF4400">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">OG Image Preview</h3>
            <div className="rounded-[2px] border border-white/[0.06] bg-white/[0.02] aspect-[1200/630] flex items-center justify-center">
              <div className="text-center">
                <span className="text-[24px] font-['Outfit'] font-black"><span className="text-white">REV</span><span className="text-[#FF4400]">OS</span></span>
                <p className="text-[10px] text-white/30 mt-1">1200 × 630px</p>
              </div>
            </div>
          </GlowCard>
        </div>
      </section>

      {/* 03 Twitter Cards */}
      <section>
        <SectionHeader num="03" title="Twitter Cards" subtitle="X/Twitter summary_large_image card format" />
        <GlowCard glow="#06B6D4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-[2px] bg-[#050505] border border-white/[0.06] p-4 font-mono text-[10px] space-y-1.5">
              <p><span className="text-[#06B6D4]/50">twitter:card</span> <span className="text-white/30">= "summary_large_image"</span></p>
              <p><span className="text-[#06B6D4]/50">twitter:title</span> <span className="text-white/30">= "João Guirunas CRM"</span></p>
              <p><span className="text-[#06B6D4]/50">twitter:description</span> <span className="text-white/30">= "CRM inteligente"</span></p>
              <p><span className="text-[#06B6D4]/50">twitter:image</span> <span className="text-white/30">= "/twitter-card.png"</span></p>
            </div>
            <div className="rounded-[2px] border border-white/[0.06] bg-white/[0.02] aspect-[1200/600] flex items-center justify-center">
              <div className="text-center">
                <span className="text-[18px] font-['Outfit'] font-bold text-white/40">Twitter Card</span>
                <p className="text-[9px] text-white/20 mt-1">1200 × 600px</p>
              </div>
            </div>
          </div>
        </GlowCard>
      </section>

      {/* 04 Structured Data */}
      <section>
        <SectionHeader num="04" title="Structured Data" subtitle="JSON-LD Schema.org Organization markup" />
        <GlowCard glow="#00D26A">
          <div className="flex items-center gap-2 mb-4">
            <Code2 className="w-4 h-4 text-[#00D26A]" />
            <h3 className="text-[10px] font-mono text-white/30 uppercase tracking-[0.08em]">JSON-LD</h3>
          </div>
          <div className="rounded-[2px] bg-[#050505] border border-white/[0.06] p-5 font-mono text-[10px] leading-relaxed">
            <pre className="text-white/30">{`{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "REVOS",
  "url": "https://revos.com.br",
  "logo": "https://revos.com.br/logo.svg",
  "sameAs": [
    "https://twitter.com/revoscrm",
    "https://linkedin.com/company/revos"
  ]
}`}</pre>
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
