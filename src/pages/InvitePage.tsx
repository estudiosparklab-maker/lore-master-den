import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Check, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type Race = Database['public']['Enums']['character_race'];
type CharClass = Database['public']['Enums']['character_class'];

const RACES: Race[] = ['Humano','Elfo','Anão','Fada','Homem Réptil','Draconiano','Orc','Ogro','Besta','Elemental'];
const CLASSES: CharClass[] = ['Guerreiro','Assassino','Paladino','Monge','Arqueiro','Engenheiro','Mago','Feiticeiro','Bruxo','Necromante','Xamã','Bárbaro','Caçador','Pirata/Ladrão','Cavaleiro'];
const ALIGNMENT_LAW = ['Caótico', 'Neutro', 'Leal'];
const ALIGNMENT_MORAL = ['Bom', 'Neutro', 'Mau'];

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  // Character creation fields
  const [step, setStep] = useState<'invite' | 'create'>('invite');
  const [charName, setCharName] = useState('');
  const [race, setRace] = useState<Race>('Humano');
  const [charClass, setCharClass] = useState<CharClass>('Guerreiro');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [alignLaw, setAlignLaw] = useState('Neutro');
  const [alignMoral, setAlignMoral] = useState('Neutro');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);

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

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      setIconPreview(URL.createObjectURL(file));
    }
  };

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

  const handleAccept = async () => {
    setStep('create');
  };

  const handleCreateAndJoin = async () => {
    if (!charName.trim()) { toast.error('Digite o nome do personagem'); return; }
    setJoining(true);

    // Upload icon if provided
    let iconUrl: string | null = null;
    if (iconFile) {
      const path = `${user.id}/${Date.now()}_${iconFile.name}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, iconFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        iconUrl = urlData.publicUrl;
      }
    }

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

    // Create character
    const { error: charError } = await supabase.from('character_sheets').insert({
      table_id: invite.table_id,
      user_id: user.id,
      name: charName.trim(),
      race,
      class: charClass,
      height: height || null,
      weight: weight || null,
      alignment_law: alignLaw,
      alignment_moral: alignMoral,
      icon_url: iconUrl,
    });

    if (charError) toast.error('Erro ao criar ficha: ' + charError.message);

    // Mark invite as used
    await supabase.from('table_invitations').update({ used_by: user.id }).eq('id', invite.id);

    toast.success('Bem-vindo à mesa! Sua ficha foi criada.');
    navigate(`/table/${invite.table_id}`);
  };

  if (step === 'create') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card-medieval w-full max-w-lg p-6">
          <h1 className="font-cinzel text-lg text-gold-gradient mb-1">Criar Personagem</h1>
          <p className="text-xs text-muted-foreground mb-4">Mesa: {tableName}</p>

          <div className="space-y-3">
            {/* Icon */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/30 bg-secondary overflow-hidden">
                {iconPreview ? (
                  <img src={iconPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl text-muted-foreground">?</span>
                )}
              </div>
              <div>
                <label className="flex items-center gap-1 cursor-pointer rounded-sm border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-gold hover:text-gold transition-colors">
                  <Upload className="h-3 w-3" /> Ícone do personagem
                  <input type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Nome do Personagem *</label>
              <input value={charName} onChange={e => setCharName(e.target.value)} required
                className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                placeholder="Nome do aventureiro" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Raça</label>
                <select value={race} onChange={e => setRace(e.target.value as Race)}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
                  {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Classe</label>
                <select value={charClass} onChange={e => setCharClass(e.target.value as CharClass)}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Altura</label>
                <input value={height} onChange={e => setHeight(e.target.value)}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                  placeholder="1.80m" />
              </div>
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Peso</label>
                <input value={weight} onChange={e => setWeight(e.target.value)}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                  placeholder="75kg" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Alinhamento (Lei)</label>
                <select value={alignLaw} onChange={e => setAlignLaw(e.target.value)}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
                  {ALIGNMENT_LAW.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Alinhamento (Moral)</label>
                <select value={alignMoral} onChange={e => setAlignMoral(e.target.value)}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
                  {ALIGNMENT_MORAL.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleCreateAndJoin} disabled={joining}
                className="flex-1 flex items-center justify-center gap-2 rounded-sm border border-gold bg-gold/10 px-4 py-2.5 font-cinzel text-sm text-gold hover:bg-gold/20 disabled:opacity-50">
                <Check className="h-4 w-4" />
                {joining ? 'Criando...' : 'Criar e Entrar'}
              </button>
              <button onClick={() => setStep('invite')}
                className="rounded-sm border border-border px-4 py-2.5 font-cinzel text-sm text-muted-foreground hover:text-foreground">
                Voltar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="card-medieval max-w-md p-8 text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-gold" />
        <h1 className="font-cinzel text-xl text-gold-gradient">Convite para Aventura</h1>
        <p className="mt-3 text-foreground">Você foi convidado para a mesa:</p>
        <p className="mt-2 font-cinzel text-lg text-gold">{tableName}</p>
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={handleAccept}
            className="flex items-center gap-2 rounded-sm border border-gold bg-gold/10 px-6 py-2.5 font-cinzel text-sm text-gold hover:bg-gold/20">
            <Check className="h-4 w-4" /> Aceitar Convite
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
