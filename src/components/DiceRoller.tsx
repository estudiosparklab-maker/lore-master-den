import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dices } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface DiceRoll {
  id: string;
  character_name: string | null;
  num_dice: number;
  num_faces: number;
  results: number[];
  total: number;
  created_at: string;
  user_id: string;
}

interface Props {
  tableId: string;
  characterName?: string;
}

const DiceRoller = ({ tableId, characterName }: Props) => {
  const { user } = useAuth();
  const [numDice, setNumDice] = useState(1);
  const [numFaces, setNumFaces] = useState(20);
  const [rolls, setRolls] = useState<DiceRoll[]>([]);
  const [rolling, setRolling] = useState(false);
  const [animValues, setAnimValues] = useState<number[]>([]);
  const rollsEndRef = useRef<HTMLDivElement>(null);

  const fetchRolls = async () => {
    const { data } = await supabase
      .from('dice_rolls')
      .select('*')
      .eq('table_id', tableId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setRolls(data as DiceRoll[]);
  };

  useEffect(() => { fetchRolls(); }, [tableId]);

  useEffect(() => {
    const channel = supabase
      .channel(`dice-${tableId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dice_rolls', filter: `table_id=eq.${tableId}` }, (payload) => {
        setRolls(prev => [payload.new as DiceRoll, ...prev].slice(0, 20));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId]);

  const rollDice = async () => {
    if (!user) return;
    setRolling(true);

    // Animate random values
    const animInterval = setInterval(() => {
      setAnimValues(Array.from({ length: numDice }, () => Math.floor(Math.random() * numFaces) + 1));
    }, 80);

    await new Promise(r => setTimeout(r, 1000));
    clearInterval(animInterval);

    const results = Array.from({ length: numDice }, () => Math.floor(Math.random() * numFaces) + 1);
    const total = results.reduce((a, b) => a + b, 0);

    setAnimValues(results);

    const { error } = await supabase.from('dice_rolls').insert({
      table_id: tableId,
      user_id: user.id,
      character_name: characterName || null,
      num_dice: numDice,
      num_faces: numFaces,
      results,
      total,
    });

    if (error) toast.error('Erro ao rolar dados');
    setRolling(false);
    setAnimValues([]);
  };

  const commonDice = [4, 6, 8, 10, 12, 20, 100];

  return (
    <div className="card-medieval p-4">
      <div className="flex items-center gap-2 mb-3">
        <Dices className="h-4 w-4 text-gold" />
        <h3 className="font-cinzel text-sm text-foreground">Rolagem de Dados</h3>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number" min={1} max={20} value={numDice}
          onChange={e => setNumDice(Math.max(1, Math.min(20, Number(e.target.value))))}
          className="w-14 rounded-sm border border-border bg-input px-2 py-1.5 text-center text-sm text-foreground focus:border-gold focus:outline-none"
        />
        <span className="text-sm text-muted-foreground font-cinzel">D</span>
        <input
          type="number" min={2} max={100} value={numFaces}
          onChange={e => setNumFaces(Math.max(2, Math.min(100, Number(e.target.value))))}
          className="w-16 rounded-sm border border-border bg-input px-2 py-1.5 text-center text-sm text-foreground focus:border-gold focus:outline-none"
        />
        <button onClick={rollDice} disabled={rolling}
          className="flex-1 rounded-sm border border-gold bg-gold/10 px-3 py-1.5 font-cinzel text-xs text-gold hover:bg-gold/20 disabled:opacity-50 transition-colors">
          {rolling ? '🎲 Rolando...' : '🎲 Rolar!'}
        </button>
      </div>

      {/* Quick dice buttons */}
      <div className="flex flex-wrap gap-1 mb-3">
        {commonDice.map(d => (
          <button key={d} onClick={() => setNumFaces(d)}
            className={`rounded-sm px-2 py-1 text-[10px] font-cinzel transition-colors ${
              numFaces === d ? 'bg-gold/20 text-gold border border-gold' : 'border border-border text-muted-foreground hover:text-foreground'
            }`}>
            D{d}
          </button>
        ))}
      </div>

      {/* Rolling animation */}
      <AnimatePresence>
        {rolling && animValues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-wrap justify-center gap-2 py-4"
          >
            {animValues.map((v, i) => (
              <motion.div key={i}
                animate={{ rotateZ: [0, 360] }}
                transition={{ duration: 0.3, repeat: Infinity }}
                className="flex h-10 w-10 items-center justify-center rounded-sm border-2 border-gold bg-gold/20 font-cinzel text-lg font-bold text-gold">
                {v}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roll history */}
      <div className="max-h-40 overflow-auto space-y-1">
        {rolls.map(roll => (
          <div key={roll.id} className="flex items-center justify-between rounded-sm bg-secondary/50 px-2 py-1.5 text-xs">
            <span className="text-gold font-cinzel">{roll.character_name || 'Anônimo'}</span>
            <span className="text-muted-foreground">
              {roll.num_dice}D{roll.num_faces}: [{roll.results?.join(', ')}] = <span className="text-foreground font-bold">{roll.total}</span>
            </span>
          </div>
        ))}
        <div ref={rollsEndRef} />
      </div>
    </div>
  );
};

export default DiceRoller;
