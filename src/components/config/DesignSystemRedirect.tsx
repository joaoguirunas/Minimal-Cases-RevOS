/**
 * DesignSystemRedirect — registry adapter for /settings/general/design-system
 *
 * The Design System lives at a top-level full-screen route (/design-system).
 * To make it discoverable from the Settings menu we register an entry that
 * simply redirects there. Keeps the registry as single source of truth for
 * the sidebar entry while preserving the dedicated route.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DesignSystemRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/design-system', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Palette className="w-5 h-5 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-[15px] font-semibold text-foreground">Design System</h2>
        <p className="text-[12px] text-muted-foreground mt-1.5">
          Abrindo a página dedicada do Design System...
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/design-system', { replace: true })}
        >
          Abrir agora <ArrowUpRight />
        </Button>
      </div>
    </div>
  );
};

export default DesignSystemRedirect;
