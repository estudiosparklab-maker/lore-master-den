import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type Race = Database['public']['Enums']['character_race'];
type CharClass = Database['public']['Enums']['character_class'];

const RACES: Race[] = ['Humano','Elfo','Anão','Fada','Homem Réptil','Draconiano','Orc','Ogro','Besta','Elemental'];
const CLASSES: CharClass[] = ['Guerreiro','Assassino','Paladino','Monge','Arqueiro','Engenheiro','Mago','Feiticeiro','Bruxo','Necromante','Xamã','Bárbaro','Caçador','Pirata/Ladrão','Cavaleiro'];

interface Props {
  tableId: string;
  maxLevel: number;
  onClose: () => void;
  onCreated: () => void;
}

const CreateCharacterForm = ({ tableId, maxLevel, onClose, onCreated }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [race, setRace] = useState<Race>('Humano');
  const [charClass, setCharClass] = useState<CharClass>('Guerreiro');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;
    setCreating(true);

    const { error } = await supabase.from('character_sheets').insert({
      table_id: tableId,
      user_id: user.id,
      name,
      race,
      class: charClass,
    });

    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Personagem criado!'); onCreated(); }
    setCreating(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="card-medieval w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-cinzel text-lg text-gold-gradient">Novo Personagem</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              placeholder="Nome do aventureiro" />
          </div>
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
          <button type="submit" disabled={creating}
            className="w-full rounded-sm border border-gold bg-gold/10 px-4 py-2.5 font-cinzel text-sm text-gold hover:bg-gold/20 disabled:opacity-50">
            {creating ? 'Criando...' : 'Criar Personagem'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default CreateCharacterForm;
