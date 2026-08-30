import { useParams } from 'react-router-dom';
import { MobileConversaSingle } from '@/components/mobile/conversas/MobileConversaSingle';

const MobileConversaDetail = () => {
  const { id: pessoaId = '' } = useParams<{ id: string }>();
  return <MobileConversaSingle pessoaId={pessoaId} />;
};

export default MobileConversaDetail;
