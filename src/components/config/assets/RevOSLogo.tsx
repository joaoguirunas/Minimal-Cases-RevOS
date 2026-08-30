import { useCallback } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GSSymbol, GSLockup } from '@/components/ui/GrowthSalesLogo';

interface RevOSLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark';
  className?: string;
}

const SYMBOL_SIZES = { xs: 18, sm: 26, md: 36, lg: 50, xl: 68 };
const TEXT_SIZES   = { xs: 11, sm: 14, md: 20, lg: 28, xl: 38 };

export function RevOSLogo({ size = 'md', variant = 'full', className }: RevOSLogoProps) {
  const s = SYMBOL_SIZES[size];
  if (variant === 'mark') {
    return <span className={cn('inline-flex', className)}><GSSymbol size={s} /></span>;
  }
  return (
    <span className={cn('inline-flex items-center', className)}>
      <GSLockup symbolSize={s} textSize={TEXT_SIZES[size]} />
    </span>
  );
}

export function RevOSLogoDownload() {
  const GS_PATH = "M921.001 706.671L919.622 707.725L920.209 708.15L898.465 723.903L889.106 731.061L888.953 730.795L511.604 1004.19L103 708.15L126.317 691.256L104.876 706.671L512 20V412.399L843.971 652.915L512.001 78.1611V20L921.001 706.671ZM166.956 708.148L511.604 957.849L856.253 708.148L511.604 458.447L166.956 708.148Z";

  const download = useCallback(() => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="gs" x1="22.75" y1="628.32" x2="804.51" y2="198.61" gradientUnits="userSpaceOnUse">
    <stop offset="0.1" stop-color="#FF4400"/>
    <stop offset="1" stop-color="#FF1A00"/>
  </linearGradient>
</defs>
<path fill-rule="evenodd" clip-rule="evenodd" d="${GS_PATH}" fill="url(#gs)"/>
</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'growthsales-symbol.svg';
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }, [GS_PATH]);

  return (
    <div className="flex items-center gap-6 p-5 rounded-[6px] border border-border bg-card">
      <div className="flex items-center justify-center w-16 h-16 rounded-[8px] bg-[#0a0a0f] flex-shrink-0 p-2">
        <GSSymbol size={44} />
      </div>
      <div className="flex items-center px-4 py-3 rounded-[6px] bg-[#0a0a0f] flex-shrink-0">
        <GSLockup symbolSize={40} textSize={22} />
      </div>
      <div className="flex flex-col gap-1.5 ml-auto">
        <Button variant="outline" size="sm" className="h-7 text-[10px] px-2.5 gap-1" onClick={download}>
          <Download className="w-3 h-3" /> Symbol SVG
        </Button>
      </div>
    </div>
  );
}

export default RevOSLogo;
