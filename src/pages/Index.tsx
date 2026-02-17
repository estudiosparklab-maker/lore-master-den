import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="animate-torch-flicker text-gold text-xl font-cinzel">Carregando...</div></div>;
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
};

export default Index;
