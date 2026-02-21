import { useState, useEffect, useRef } from 'react';
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
import Journal from '@/components/Journal';
import { ArrowLeft, Plus, Swords, Copy, Users, Map, Dices, Eye, BookOpen, CheckSquare, Trash2, Zap, Heart, ShieldOff, Sparkles } from 'lucide-react';
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
  const [activePanel, setActivePanel] = useState<'scene' | 'characters' | 'dice' | 'maps' | 'journal'>('scene');
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});

  // Bulk selection state
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'xp' | 'damage' | 'heal' | null>(null);
  const [bulkAmount, setBulkAmount] = useState(0);

  const prevCharCountRef = useRef(0);

  const fetchData = async () => {
    if (!id || !user) return;

    const [tableRes, charsRes, membersRes] = await Promise.all([
      supabase.from('game_tables').select('*').eq('id', id).single(),
      supabase.from('character_sheets').select('*').eq('table_id', id),
      supabase.from('table_memberships').select('user_id, role').eq('table_id', id),
    ]);

    if (tableRes.data) setTable(tableRes.data);
    if (charsRes.data) {
      // Notify master about new characters
      if (prevCharCountRef.current > 0 && charsRes.data.length > prevCharCountRef.current) {
        const newChars = charsRes.data.filter(c => !characters.find(old => old.id === c.id));
        newChars.forEach(nc => {
          toast.info(`Um jogador entrou na mesa`, { description: `${nc.name} - Personagem criado` });
        });
      }
      prevCharCountRef.current = charsRes.data.length;
      setCharacters(charsRes.data);
    }

    if (membersRes.data) {
      const profiles = await supabase.from('profiles').select('user_id, display_name');
      const merged: MemberInfo[] = membersRes.data.map(m => ({
        ...m,
        display_name: profiles.data?.find(p => p.user_id === m.user_id)?.display_name || 'Desconhecido',
        character: charsRes.data?.find(c => c.user_id === m.user_id),
        is_online: presenceMap[m.user_id] ?? false,
      }));
      setMembers(merged);
      setIsMaster(membersRes.data.some(m => m.user_id === user.id && m.role === 'master'));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id, user]);

  // Presence
  useEffect(() => {
    if (!id || !user) return;
    const channel = supabase.channel(`presence-${id}`, { config: { presence: { key: user.id } } });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online: Record<string, boolean> = {};
        Object.keys(state).forEach(key => { online[key] = true; });
        setPresenceMap(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [id, user]);

  // Update members when presence changes
  useEffect(() => {
    setMembers(prev => prev.map(m => ({ ...m, is_online: presenceMap[m.user_id] ?? false })));
  }, [presenceMap]);

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

  const shareTableLink = () => {
    if (!id) return;
    const link = `${window.location.origin}/join/${id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link de convite copiado!');
  };

  // Bulk actions
  const toggleCharSelection = (charId: string) => {
    setSelectedChars(prev => {
      const next = new Set(prev);
      if (next.has(charId)) next.delete(charId); else next.add(charId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedChars.size === characters.length) setSelectedChars(new Set());
    else setSelectedChars(new Set(characters.map(c => c.id)));
  };

  const applyBulkAction = async () => {
    if (bulkAmount <= 0 || selectedChars.size === 0) return;

    for (const charId of selectedChars) {
      const char = characters.find(c => c.id === charId);
      if (!char) continue;

      if (bulkAction === 'xp') {
        await supabase.from('character_sheets').update({ xp: char.xp + bulkAmount }).eq('id', charId);
      } else if (bulkAction === 'damage') {
        const newHp = Math.max(0, (char as any).current_hp - bulkAmount);
        await supabase.from('character_sheets').update({ current_hp: newHp }).eq('id', charId);
      } else if (bulkAction === 'heal') {
        const newHp = Math.min(char.hit_points, (char as any).current_hp + bulkAmount);
        await supabase.from('character_sheets').update({ current_hp: newHp }).eq('id', charId);
      }
    }

    const labels = { xp: 'XP', damage: 'Dano', heal: 'Cura' };
    toast.success(`${labels[bulkAction!]} de ${bulkAmount} aplicado a ${selectedChars.size} personagen(s)!`);
    setBulkAction(null);
    setBulkAmount(0);
    fetchData();
  };

  const deleteSelectedChars = async () => {
    if (selectedChars.size === 0) return;
    for (const charId of selectedChars) {
      await supabase.from('character_sheets').delete().eq('id', charId);
    }
    toast.success(`${selectedChars.size} ficha(s) excluída(s)`);
    setSelectedChars(new Set());
    fetchData();
  };

  const kickSelectedPlayers = async () => {
    if (selectedChars.size === 0 || !id) return;
    for (const charId of selectedChars) {
      const char = characters.find(c => c.id === charId);
      if (char) {
        await supabase.from('character_sheets').delete().eq('id', charId);
        await supabase.from('table_memberships').delete().eq('table_id', id).eq('user_id', char.user_id);
      }
    }
    toast.success(`${selectedChars.size} jogador(es) expulso(s)`);
    setSelectedChars(new Set());
    fetchData();
  };

  const selectedChar = characters.find(c => c.id === selectedCharId);
  const currentTurnChar = characters.find(c => c.id === table?.current_turn_character_id);
  const myCharacter = characters.find(c => c.user_id === user?.id);

  if (loading) return <AppLayout collapsedSidebar><div className="flex h-screen items-center justify-center"><span className="text-gold font-cinzel">Carregando mesa...</span></div></AppLayout>;
  if (!table) return <AppLayout collapsedSidebar><div className="flex h-screen items-center justify-center"><span className="text-muted-foreground font-cinzel">Mesa não encontrada.</span></div></AppLayout>;

  const panels = [
    { key: 'scene' as const, label: 'Cena Atual', icon: Eye },
    { key: 'characters' as const, label: 'Fichas', icon: Users },
    { key: 'dice' as const, label: 'Dados', icon: Dices },
    { key: 'journal' as const, label: 'Jornal', icon: BookOpen },
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
            {/* Online count */}
            <div className="flex items-center gap-1 ml-2">
              <div className="h-2 w-2 rounded-full bg-forest" />
              <span className="text-[10px] text-muted-foreground">{Object.keys(presenceMap).length} online</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMaster && (
              <>
                <button onClick={shareTableLink} className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 font-cinzel text-[10px] text-muted-foreground hover:border-gold hover:text-gold transition-colors">
                  <Copy className="h-3 w-3" /> Convite
                </button>
                {/* Master can always create characters */}
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
              <div className="flex-1 h-full border-r border-border">
                <SceneView tableId={id!} isMaster={isMaster} characters={characters} members={members} onRefresh={fetchData} />
              </div>
              <div className={`h-full shrink-0 ${chatCollapsed ? 'w-10' : 'w-80'}`}>
                <SceneChat tableId={id!} collapsed={chatCollapsed} onToggle={() => setChatCollapsed(!chatCollapsed)} characters={characters} />
              </div>
            </div>
          )}

          {activePanel === 'characters' && (
            <div className="overflow-auto p-4">
              <div className="max-w-7xl mx-auto">
                {/* Master bulk toolbar */}
                {isMaster && (
                  <div className="flex flex-wrap items-center gap-2 mb-4 card-medieval p-3">
                    <button onClick={selectAll}
                      className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] font-cinzel text-muted-foreground hover:text-foreground transition-colors">
                      <CheckSquare className="h-3 w-3" />
                      {selectedChars.size === characters.length ? 'Desmarcar' : 'Selecionar'} Todos
                    </button>
                    {selectedChars.size > 0 && (
                      <>
                        <span className="text-[10px] text-gold font-cinzel">{selectedChars.size} selecionado(s)</span>
                        <button onClick={() => setBulkAction('xp')}
                          className="flex items-center gap-1 rounded-sm border border-gold bg-gold/10 px-2 py-1 text-[10px] font-cinzel text-gold hover:bg-gold/20">
                          <Sparkles className="h-3 w-3" /> Dar XP
                        </button>
                        <button onClick={() => setBulkAction('damage')}
                          className="flex items-center gap-1 rounded-sm border border-blood bg-blood/10 px-2 py-1 text-[10px] font-cinzel text-blood hover:bg-blood/20">
                          <Zap className="h-3 w-3" /> Dano
                        </button>
                        <button onClick={() => setBulkAction('heal')}
                          className="flex items-center gap-1 rounded-sm border border-forest bg-forest/10 px-2 py-1 text-[10px] font-cinzel text-forest hover:bg-forest/20">
                          <Heart className="h-3 w-3" /> Cura
                        </button>
                        <button onClick={deleteSelectedChars}
                          className="flex items-center gap-1 rounded-sm border border-destructive bg-destructive/10 px-2 py-1 text-[10px] font-cinzel text-destructive hover:bg-destructive/20">
                          <Trash2 className="h-3 w-3" /> Excluir
                        </button>
                        <button onClick={kickSelectedPlayers}
                          className="flex items-center gap-1 rounded-sm border border-destructive bg-destructive/10 px-2 py-1 text-[10px] font-cinzel text-destructive hover:bg-destructive/20">
                          <ShieldOff className="h-3 w-3" /> Expulsar
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Bulk action modal */}
                {bulkAction && (
                  <div className="card-medieval p-4 mb-4 flex items-center gap-3">
                    <span className="font-cinzel text-sm text-foreground">
                      {bulkAction === 'xp' ? 'Experiência' : bulkAction === 'damage' ? 'Dano' : 'Cura'}:
                    </span>
                    <input type="number" min={1} value={bulkAmount} onChange={e => setBulkAmount(Number(e.target.value))}
                      className="w-20 rounded-sm border border-border bg-input px-2 py-1 text-center text-sm text-foreground focus:border-gold focus:outline-none" autoFocus />
                    <button onClick={applyBulkAction}
                      className="rounded-sm border border-gold bg-gold/10 px-3 py-1 font-cinzel text-xs text-gold hover:bg-gold/20">
                      Aplicar
                    </button>
                    <button onClick={() => setBulkAction(null)}
                      className="rounded-sm border border-border px-3 py-1 font-cinzel text-xs text-muted-foreground hover:text-foreground">
                      Cancelar
                    </button>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {characters.map((char, i) => (
                    <motion.div
                      key={char.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`card-medieval cursor-pointer p-4 transition-all hover:glow-gold ${
                        table.current_turn_character_id === char.id ? 'ring-2 ring-gold glow-gold' : ''
                      } ${selectedChars.has(char.id) ? 'ring-2 ring-primary' : ''}`}
                    >
                      {/* Selection checkbox for master */}
                      {isMaster && (
                        <div className="flex justify-end mb-1">
                          <input type="checkbox" checked={selectedChars.has(char.id)}
                            onChange={() => toggleCharSelection(char.id)}
                            className="h-3.5 w-3.5 rounded-sm border-border accent-gold cursor-pointer" />
                        </div>
                      )}
                      <div onClick={() => setSelectedCharId(char.id)}>
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
                            <p className="text-xs text-blood font-bold">❤ {(char as any).current_hp}/{char.hit_points}</p>
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
                        {/* HP bar */}
                        <div className="mt-2">
                          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-blood rounded-full transition-all"
                              style={{ width: `${char.hit_points > 0 ? ((char as any).current_hp / char.hit_points) * 100 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                      {isMaster && (
                        <div className="mt-3 space-y-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setTurn(char.id); }}
                            className="w-full rounded-sm border border-border py-1 text-[10px] font-cinzel text-muted-foreground hover:border-gold hover:text-gold transition-colors"
                          >
                            Definir Turno
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedChars(new Set([char.id])); setBulkAction('xp'); }}
                            className="w-full rounded-sm border border-border py-1 text-[10px] font-cinzel text-muted-foreground hover:border-gold hover:text-gold transition-colors"
                          >
                            Dar Experiência
                          </button>
                        </div>
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

          {activePanel === 'journal' && (
            <Journal tableId={id!} isMaster={isMaster} characters={characters} />
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
