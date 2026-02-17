import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) return;
      const { data } = await supabase.from('table_invitations').select('*, game_tables(name)').eq('token', token).maybeSingle();
      if (data) {
        setInvite(data);
        setTableName((data as any).game_tables?.name || 'Mesa desconhecida');
      }
      setLoading(false);
    };
    fetchInvite();
  }, [token]);

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-gold font-cinzel">Carregando...</div></div>;
  if (!user) { navigate('/login'); return null; }

  if (!invite || invite.used_by || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="card-medieval max-w-md p-8 text-center">
          <X className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="font-cinzel text-xl text-foreground">Convite Inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">Este convite expirou ou já foi utilizado.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-6 rounded-sm border border-border px-4 py-2 font-cinzel text-sm text-muted-foreground hover:text-foreground">
            Ir para Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleJoin = async () => {
    setJoining(true);
    // Add as member
    const { error: memberError } = await supabase.from('table_memberships').insert({
      table_id: invite.table_id,
      user_id: user.id,
      role: 'player' as any,
    });

    if (memberError) {
      if (memberError.code === '23505') {
        toast.info('Você já faz parte desta mesa!');
        navigate(`/table/${invite.table_id}`);
      } else {
        toast.error('Erro ao entrar: ' + memberError.message);
      }
      setJoining(false);
      return;
    }

    // Mark invite as used
    await supabase.from('table_invitations').update({ used_by: user.id }).eq('id', invite.id);

    toast.success('Bem-vindo à mesa!');
    navigate(`/table/${invite.table_id}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="card-medieval max-w-md p-8 text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-gold" />
        <h1 className="font-cinzel text-xl text-gold-gradient">Convite para Aventura</h1>
        <p className="mt-3 text-foreground">Você foi convidado para a mesa:</p>
        <p className="mt-2 font-cinzel text-lg text-gold">{tableName}</p>
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={handleJoin} disabled={joining}
            className="flex items-center gap-2 rounded-sm border border-gold bg-gold/10 px-6 py-2.5 font-cinzel text-sm text-gold hover:bg-gold/20 disabled:opacity-50">
            <Check className="h-4 w-4" />
            {joining ? 'Entrando...' : 'Aceitar Convite'}
          </button>
          <button onClick={() => navigate('/dashboard')}
            className="rounded-sm border border-border px-6 py-2.5 font-cinzel text-sm text-muted-foreground hover:text-foreground">
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvitePage;
