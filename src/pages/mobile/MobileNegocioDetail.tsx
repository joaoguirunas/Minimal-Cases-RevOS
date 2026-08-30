import { useParams, useNavigate } from 'react-router-dom';
import { MobileNegocioSingle } from '@/components/mobile/negocios/MobileNegocioSingle';

const MobileNegocioDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return null;
  }

  return (
    <MobileNegocioSingle
      negocioId={id}
      onBack={() => navigate(-1)}
    />
  );
};

export default MobileNegocioDetail;
