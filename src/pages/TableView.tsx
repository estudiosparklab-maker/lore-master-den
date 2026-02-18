import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import CharacterSheet from '@/components/CharacterSheet';
import CreateCharacterForm from '@/components/CreateCharacterForm';
import SceneView from '@/components/SceneView';
import SceneChat from '@/components/SceneChat';
import DiceFeed from '@/components/DiceFeed';
import MapManager from '@/components/MapManager';
import { ArrowLeft, Plus, Swords, Copy, Users, Map, Dices, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';

type CharacterSheetRow = Tables<'character_sheets'>;
type GameTableRow = Tables<'game_tables'>;

interface MemberInfo {
  user_id: string;
  role: string;
  display_name: string;
  is_online?: boolean;
  character?: CharacterSheetRow;
}

const TableView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [table, setTable] = useState<GameTableRow | null>(null);
  const [characters, setCharacters] = useState<CharacterSheetRow[]>([]);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<'scene' | 'characters' | 'dice' | 'maps'>('scene');

  const fetchData = async () => {
    if (!id || !user) return;

    const [tableRes, charsRes, membersRes] = await Promise.all([
      supabase.from('game_tables').select('*').eq('id', id).single(),
      supabase.from('character_sheets').select('*').eq('table_id', id),
      supabase.from('table_memberships').select('user_id, role').eq('table_id', id),
    ]);

    if (tableRes.data) setTable(tableRes.data);
    if (charsRes.data) setCharacters(charsRes.data);

    if (membersRes.data) {
      const profiles = await supabase.from('profiles').select('user_id, display_name');
      const merged: MemberInfo[] = membersRes.data.map(m => ({
        ...m,
        display_name: profiles.data?.find(p => p.user_id === m.user_id)?.display_name || 'Desconhecido',
        character: charsRes.data?.find(c => c.user_id === m.user_id),
      }));
      setMembers(merged);
      setIsMaster(membersRes.data.some(m => m.user_id === user.id && m.role === 'master'));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id, user]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`table-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'character_sheets', filter: `table_id=eq.${id}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_tables', filter: `id=eq.${id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const setTurn = async (characterId: string | null) => {
    if (!id) return;
    await supabase.from('game_tables').update({ current_turn_character_id: characterId }).eq('id', id);
    toast.success(characterId ? 'Turno atualizado!' : 'Turno resetado');
    fetchData();
  };

  const createInviteLink = async () => {
    if (!user || !id) return;
    const { data, error } = await supabase.from('table_invitations').insert({
      table_id: id,
      invited_by: user.id,
    }).select('token').single();
    if (error) { toast.error('Erro ao criar convite'); return; }
    const link = `${window.location.origin}/invite/${data.token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link de convite copiado!');
  };

  const selectedChar = characters.find(c => c.id === selectedCharId);
  const currentTurnChar = characters.find(c => c.id === table?.current_turn_character_id);
  const myCharacter = characters.find(c => c.user_id === user?.id);

  if (loading) return <AppLayout collapsedSidebar><div className="flex h-screen items-center justify-center"><span className="text-gold font-cinzel">Carregando mesa...</span></div></AppLayout>;
  if (!table) return <AppLayout collapsedSidebar><div className="flex h-screen items-center justify-center"><span className="text-muted-foreground font-cinzel">Mesa não encontrada.</span></div></AppLayout>;

  // Panels for player vs master
  const panels = [
    { key: 'scene' as const, label: 'Cena Atual', icon: Eye },
    { key: 'characters' as const, label: 'Fichas', icon: Users },
    { key: 'dice' as const, label: 'Dados', icon: Dices },
    ...(isMaster ? [{ key: 'maps' as const, label: 'Mapa', icon: Map }] : []),
  ];

  return (
    <AppLayout collapsedSidebar>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-2">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="font-cinzel text-sm text-gold-gradient">{table.name}</h1>
            {currentTurnChar && (
              <div className="flex items-center gap-1.5 ml-4 rounded-sm bg-gold/10 border border-gold/30 px-2 py-1">
                <Swords className="h-3 w-3 text-gold" />
                <span className="text-[10px] font-cinzel text-gold">Turno: {currentTurnChar.name}</span>
                {isMaster && (
                  <button onClick={() => setTurn(null)} className="text-[9px] text-muted-foreground hover:text-foreground ml-1">✕</button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMaster && (
              <>
                <button onClick={createInviteLink} className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 font-cinzel text-[10px] text-muted-foreground hover:border-gold hover:text-gold transition-colors">
                  <Copy className="h-3 w-3" /> Convite
                </button>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 rounded-sm border border-gold bg-gold/10 px-2 py-1 font-cinzel text-[10px] text-gold hover:bg-gold/20 transition-colors">
                  <Plus className="h-3 w-3" /> Ficha
                </button>
              </>
            )}
          </div>
        </div>

        {/* Panel tabs */}
        <div className="flex border-b border-border bg-card/30">
          {panels.map(p => (
            <button key={p.key} onClick={() => setActivePanel(p.key)}
              className={`flex items-center gap-1.5 px-4 py-2 font-cinzel text-xs transition-colors border-b-2 ${
                activePanel === p.key ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <p.icon className="h-3.5 w-3.5" />
              {p.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activePanel === 'scene' && (
            <div className="flex h-full">
              {/* Map area - left side */}
              <div className="flex-1 h-full border-r border-border">
                <SceneView tableId={id!} isMaster={isMaster} characters={characters} members={members} />
              </div>
              {/* Chat - right side */}
              <div className="w-80 h-full shrink-0">
                <SceneChat tableId={id!} />
              </div>
            </div>
          )}

          {activePanel === 'characters' && (
            <div className="overflow-auto p-4">
              <div className="max-w-7xl mx-auto">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {characters.map((char, i) => (
                    <motion.div
                      key={char.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedCharId(char.id)}
                      className={`card-medieval cursor-pointer p-4 transition-all hover:glow-gold ${
                        table.current_turn_character_id === char.id ? 'ring-2 ring-gold glow-gold' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-secondary overflow-hidden">
                            {char.icon_url ? (
                              <img src={char.icon_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-cinzel text-sm text-muted-foreground">{char.name?.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-cinzel text-sm text-foreground">{char.name}</h3>
                            <p className="text-xs text-muted-foreground">{char.race} • {char.class}</p>
                          </div>
                        </div>
                        <span className="rounded-sm bg-gold/10 px-2 py-0.5 font-cinzel text-xs text-gold">
                          Nv {Math.min(Math.floor(char.xp / 100), table.max_level)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-blood font-bold">❤ {char.hit_points}</p>
                          <p className="text-[10px] text-muted-foreground">Vida</p>
                        </div>
                        <div>
                          <p className="text-xs text-mana-blue font-bold">✦ {char.mana}</p>
                          <p className="text-[10px] text-muted-foreground">Mana</p>
                        </div>
                        <div>
                          <p className="text-xs text-gold font-bold">★ {char.xp}</p>
                          <p className="text-[10px] text-muted-foreground">XP</p>
                        </div>
                      </div>
                      {isMaster && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setTurn(char.id); }}
                          className="mt-3 w-full rounded-sm border border-border py-1 text-[10px] font-cinzel text-muted-foreground hover:border-gold hover:text-gold transition-colors"
                        >
                          Definir Turno
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
                {characters.length === 0 && (
                  <div className="card-medieval p-12 text-center mt-4">
                    <p className="font-cinzel text-muted-foreground">Nenhum personagem nesta mesa ainda.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activePanel === 'dice' && (
            <div className="h-full max-w-2xl mx-auto">
              <DiceFeed tableId={id!} characterName={myCharacter?.name} />
            </div>
          )}

          {activePanel === 'maps' && isMaster && (
            <div className="overflow-auto h-full">
              <MapManager tableId={id!} />
            </div>
          )}
        </div>

        {/* Modals */}
        {showCreate && (
          <CreateCharacterForm
            tableId={id!}
            maxLevel={table.max_level}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); fetchData(); }}
          />
        )}

        {selectedChar && (
          <CharacterSheet
            character={selectedChar}
            isMaster={isMaster}
            maxLevel={table.max_level}
            onClose={() => setSelectedCharId(null)}
            onUpdate={fetchData}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default TableView;
