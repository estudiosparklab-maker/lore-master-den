import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type Race = Database['public']['Enums']['character_race'];
type CharClass = Database['public']['Enums']['character_class'];

const RACES: Race[] = ['Humano','Elfo','Anão','Fada','Homem Réptil','Draconiano','Orc','Ogro','Besta','Elemental'];
const CLASSES: CharClass[] = ['Guerreiro','Assassino','Paladino','Monge','Arqueiro','Engenheiro','Mago','Feiticeiro','Bruxo','Necromante','Xamã','Bárbaro','Caçador','Pirata/Ladrão','Cavaleiro'];
const ALIGNMENT_LAW = ['Caótico', 'Neutro', 'Leal'];
const ALIGNMENT_MORAL = ['Bom', 'Neutro', 'Mau'];

const JoinTable = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tableName, setTableName] = useState('');
  const [tableDesc, setTableDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joining, setJoining] = useState(false);

  // Character fields
  const [step, setStep] = useState<'info' | 'create'>('info');
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
    const fetchTableInfo = async () => {
      if (!tableId) return;
      try {
        const { data, error } = await supabase.functions.invoke('get-table-info', {
          body: null,
          method: 'GET',
        });
        // Use fetch directly since functions.invoke doesn't support query params well
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-table-info?table_id=${tableId}`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        if (!res.ok) { setNotFound(true); setLoading(false); return; }
        const info = await res.json();
        setTableName(info.name);
        setTableDesc(info.description || '');
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    };
    fetchTableInfo();
  }, [tableId]);

  // Check if already member once authenticated
  useEffect(() => {
    const checkMembership = async () => {
      if (!user || !tableId) return;
      const { data } = await supabase
        .from('table_memberships')
        .select('id')
        .eq('table_id', tableId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setAlreadyMember(true);
    };
    checkMembership();
  }, [user, tableId]);

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      setIconPreview(URL.createObjectURL(file));
    }
  };

  const handleCreateAndJoin = async () => {
    if (!user || !tableId) return;
    if (!charName.trim()) { toast.error('Digite o nome do personagem'); return; }
    setJoining(true);

    // Upload icon
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
      table_id: tableId,
      user_id: user.id,
      role: 'player' as any,
    });

    if (memberError) {
      if (memberError.code === '23505') {
        toast.info('Você já faz parte desta mesa!');
        navigate(`/table/${tableId}`);
      } else {
        toast.error('Erro ao entrar: ' + memberError.message);
      }
      setJoining(false);
      return;
    }

    // Create character
    const { error: charError } = await supabase.from('character_sheets').insert({
      table_id: tableId,
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

    toast.success('Bem-vindo à mesa! Sua ficha foi criada.');
    navigate(`/table/${tableId}`);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-gold font-cinzel">Carregando...</span>
      </div>
    );
  }

  if (!user) {
    navigate('/login', { state: { redirect: `/join/${tableId}` } });
    return null;
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="card-medieval max-w-md p-8 text-center">
          <h1 className="font-cinzel text-xl text-foreground">Mesa não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">O link é inválido ou a mesa foi removida.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-6 rounded-sm border border-border px-4 py-2 font-cinzel text-sm text-muted-foreground hover:text-foreground">
            Ir para Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="card-medieval max-w-md p-8 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-gold" />
          <h1 className="font-cinzel text-xl text-gold-gradient">Você já está na mesa!</h1>
          <p className="mt-2 font-cinzel text-lg text-foreground">{tableName}</p>
          <button onClick={() => navigate(`/table/${tableId}`)} className="mt-6 flex items-center gap-2 mx-auto rounded-sm border border-gold bg-gold/10 px-6 py-2.5 font-cinzel text-sm text-gold hover:bg-gold/20">
            <Check className="h-4 w-4" /> Entrar na Mesa
          </button>
        </div>
      </div>
    );
  }

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
              <label className="flex items-center gap-1 cursor-pointer rounded-sm border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-gold hover:text-gold transition-colors">
                <Upload className="h-3 w-3" /> Ícone do personagem
                <input type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
              </label>
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
              <button onClick={() => setStep('info')}
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
        <h1 className="font-cinzel text-xl text-gold-gradient">Entrar na Aventura</h1>
        <p className="mt-3 text-foreground">Você foi convidado para a mesa:</p>
        <p className="mt-2 font-cinzel text-lg text-gold">{tableName}</p>
        {tableDesc && <p className="mt-2 text-sm text-muted-foreground">{tableDesc}</p>}
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={() => setStep('create')}
            className="flex items-center gap-2 rounded-sm border border-gold bg-gold/10 px-6 py-2.5 font-cinzel text-sm text-gold hover:bg-gold/20">
            <Check className="h-4 w-4" /> Entrar na Mesa
          </button>
          <button onClick={() => navigate('/dashboard')}
            className="rounded-sm border border-border px-6 py-2.5 font-cinzel text-sm text-muted-foreground hover:text-foreground">
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinTable;
