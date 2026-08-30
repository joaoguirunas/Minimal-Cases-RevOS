import { ConversaDemoEduardo } from '@/components/conversas/ConversaDemoEduardo';
import DashLayout from '@/components/layout/DashLayout';
import { useNavigate } from 'react-router-dom';

export default function ConversasDemo() {
  const navigate = useNavigate();

  return (
    <DashLayout title="OMNI PRO™ - Demo de Conversa">
      <div className="max-w-7xl mx-auto p-6">
        <ConversaDemoEduardo
          onVoltar={() => navigate('/omni')}
          isFullScreen={false}
        />
      </div>
    </DashLayout>
  );
}
