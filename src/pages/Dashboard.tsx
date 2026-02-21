import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Link } from 'react-router-dom';
import { Plus, Users, ScrollText, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface GameTable {
  id: string;
  name: string;
  description: string | null;
  max_level: number;
  created_by: string;
  created_at: string;
}

const Dashboard = () => {
  const { user, role } = useAuth();
  const [tables, setTables] = useState<GameTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tableName, setTableName] = useState('');
  const [tableDesc, setTableDesc] = useState('');
  const [maxLevel, setMaxLevel] = useState(20);
  const [creating, setCreating] = useState(false);

  const fetchTables = async () => {
    const { data } = await supabase.from('game_tables').select('*');
    if (data) setTables(data);
    setLoading(false);
  };

  useEffect(() => { fetchTables(); }, []);

  const createTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tableName) return;
    setCreating(true);

    // Create game table
    const { data: table, error } = await supabase.from('game_tables').insert({
      name: tableName,
      description: tableDesc || null,
      max_level: maxLevel,
      created_by: user.id,
    }).select().single();

    if (error) {
      toast.error('Erro ao criar mesa: ' + error.message);
      setCreating(false);
      return;
    }

    // Add creator as master member
    await supabase.from('table_memberships').insert({
      table_id: table.id,
      user_id: user.id,
      role: 'master' as any,
    });

    toast.success('Mesa criada com sucesso!');
    setTableName('');
    setTableDesc('');
    setMaxLevel(20);
    setShowCreate(false);
    setCreating(false);
    fetchTables();
  };

  const shareTableLink = (tableId: string) => {
    const link = `${window.location.origin}/join/${tableId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link de convite copiado!');
  };

  const isMaster = role === 'master' || role === 'admin';

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-cinzel text-2xl text-gold-gradient">Mesas de Aventura</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isMaster ? 'Gerencie suas mesas e jogadores' : 'Suas aventuras em andamento'}
            </p>
          </div>
          {isMaster && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 rounded-sm border border-gold bg-gold/10 px-4 py-2 font-cinzel text-sm text-gold transition-all hover:bg-gold/20"
            >
              <Plus className="h-4 w-4" />
              Nova Mesa
            </button>
          )}
        </div>

        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card-medieval mb-6 p-6">
            <h2 className="mb-4 font-cinzel text-lg text-foreground">Criar Nova Mesa</h2>
            <form onSubmit={createTable} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Nome da Mesa</label>
                <input value={tableName} onChange={e => setTableName(e.target.value)} required
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                  placeholder="A Masmorra do Dragão Ancião" />
              </div>
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Descrição</label>
                <textarea value={tableDesc} onChange={e => setTableDesc(e.target.value)}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                  placeholder="Descrição da aventura..." rows={2} />
              </div>
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Nível Máximo</label>
                <input type="number" value={maxLevel} onChange={e => setMaxLevel(Number(e.target.value))} min={1}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={creating}
                  className="rounded-sm border border-gold bg-gold/10 px-6 py-2 font-cinzel text-sm text-gold hover:bg-gold/20 disabled:opacity-50">
                  {creating ? 'Criando...' : 'Criar Mesa'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="rounded-sm border border-border px-6 py-2 font-cinzel text-sm text-muted-foreground hover:bg-secondary">
                  Cancelar
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-20">Carregando mesas...</div>
        ) : tables.length === 0 ? (
          <div className="card-medieval p-12 text-center">
            <ScrollText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-cinzel text-lg text-muted-foreground">Nenhuma mesa encontrada</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isMaster ? 'Crie uma mesa para iniciar sua aventura!' : 'Aguarde um convite de um Mestre.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table, i) => (
              <motion.div
                key={table.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to={`/table/${table.id}`} className="block">
                  <div className="card-medieval group p-5 transition-all hover:glow-gold">
                    <h3 className="font-cinzel text-base text-foreground group-hover:text-gold transition-colors">
                      {table.name}
                    </h3>
                    {table.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{table.description}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Nível máx: {table.max_level}
                      </span>
                      {isMaster && table.created_by === user?.id && (
                        <button
                          onClick={(e) => { e.preventDefault(); shareTableLink(table.id); }}
                          className="flex items-center gap-1 text-xs text-gold hover:text-gold-light transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                          Convite
                        </button>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
