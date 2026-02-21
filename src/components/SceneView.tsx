import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trash2, ZoomIn, ZoomOut, RotateCcw, Users, Map, Minus, Plus, Heart, Skull, UserPlus, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';

type CharacterSheetRow = Tables<'character_sheets'>;

interface MapRow {
  id: string;
  table_id: string;
  name: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
}

interface TokenRow {
  id: string;
  map_id: string;
  token_type: string;
  character_id: string | null;
  name: string | null;
  icon_url: string | null;
  hit_points: number | null;
  max_hit_points: number | null;
  x_position: number;
  y_position: number;
  token_size: number;
}

interface EnemyTemplate {
  id: string;
  table_id: string;
  name: string;
  hit_points: number;
  icon_url: string | null;
}

interface MemberInfo {
  user_id: string;
  role: string;
  display_name: string;
  is_online?: boolean;
  character?: CharacterSheetRow;
}

interface Props {
  tableId: string;
  isMaster: boolean;
  characters: CharacterSheetRow[];
  members: MemberInfo[];
  onRefresh?: () => void;
}

const SceneView = ({ tableId, isMaster, characters, members, onRefresh }: Props) => {
  const { user } = useAuth();
  const [activeMap, setActiveMap] = useState<MapRow | null>(null);
  const [allMaps, setAllMaps] = useState<MapRow[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [enemies, setEnemies] = useState<EnemyTemplate[]>([]);
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [damageTarget, setDamageTarget] = useState<{ tokenId: string; charId: string | null; name: string; isEnemy: boolean } | null>(null);
  const [damageAmount, setDamageAmount] = useState(0);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  // Multi-select
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const [showViewMaps, setShowViewMaps] = useState(false);
  const [viewingMap, setViewingMap] = useState<MapRow | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInnerRef = useRef<HTMLDivElement>(null);

  const myCharacter = characters.find(c => c.user_id === user?.id);

  const fetchMaps = async () => {
    const { data } = await supabase.from('table_maps').select('*').eq('table_id', tableId).order('created_at');
    if (data) {
      setAllMaps(data as MapRow[]);
      const active = (data as MapRow[]).find(m => m.is_active);
      setActiveMap(active || null);
    }
  };

  const fetchTokens = async (mapId: string) => {
    const { data } = await supabase.from('map_tokens').select('*').eq('map_id', mapId);
    if (data) setTokens(data as TokenRow[]);
  };

  const fetchEnemies = async () => {
    const { data } = await supabase.from('table_enemies').select('*').eq('table_id', tableId);
    if (data) setEnemies(data as EnemyTemplate[]);
  };

  useEffect(() => { fetchMaps(); fetchEnemies(); }, [tableId]);
  useEffect(() => { if (activeMap) fetchTokens(activeMap.id); else setTokens([]); }, [activeMap?.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`scene-maps-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_maps', filter: `table_id=eq.${tableId}` }, () => fetchMaps())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_enemies', filter: `table_id=eq.${tableId}` }, () => fetchEnemies())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId]);

  useEffect(() => {
    if (!activeMap) return;
    const channel = supabase
      .channel(`scene-tokens-${activeMap.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_tokens', filter: `map_id=eq.${activeMap.id}` }, () => fetchTokens(activeMap.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeMap?.id]);

  const switchMap = async (mapId: string) => {
    if (!isMaster) return;
    await supabase.from('table_maps').update({ is_active: false }).eq('table_id', tableId);
    await supabase.from('table_maps').update({ is_active: true }).eq('id', mapId);
    setShowMapSelector(false);
    toast.success('Mapa alterado!');
  };

  const addPlayerToken = async (char: CharacterSheetRow) => {
    if (!activeMap) return;
    if (tokens.find(t => t.character_id === char.id)) { toast.info('Jogador já está no mapa'); return; }
    await supabase.from('map_tokens').insert({
      map_id: activeMap.id, token_type: 'player', character_id: char.id,
      name: char.name, icon_url: char.icon_url || null,
      x_position: 50, y_position: 50,
    });
    toast.success(`${char.name} adicionado ao mapa!`);
    setShowAddMenu(false);
  };

  const addEnemyToMap = async (enemy: EnemyTemplate) => {
    if (!activeMap) return;
    await supabase.from('map_tokens').insert({
      map_id: activeMap.id, token_type: 'enemy',
      name: enemy.name, icon_url: enemy.icon_url,
      hit_points: enemy.hit_points, max_hit_points: enemy.hit_points,
      x_position: 50, y_position: 50,
    });
    toast.success(`${enemy.name} adicionado ao mapa!`);
    setShowAddMenu(false);
  };

  const removeToken = async (tokenId: string) => {
    await supabase.from('map_tokens').delete().eq('id', tokenId);
    if (activeMap) fetchTokens(activeMap.id);
  };

  const handleTokenClick = (token: TokenRow) => {
    if (!isMaster) return;
    setDamageTarget({
      tokenId: token.id,
      charId: token.character_id,
      name: token.name || '?',
      isEnemy: token.token_type === 'enemy',
    });
    setDamageAmount(0);
  };

  const applyDamageOrHeal = async (isDamage: boolean) => {
    if (!damageTarget || damageAmount <= 0) return;
    const amount = isDamage ? -damageAmount : damageAmount;

    if (damageTarget.isEnemy) {
      const token = tokens.find(t => t.id === damageTarget.tokenId);
      if (token) {
        const newHp = Math.max(0, (token.hit_points || 0) + amount);
        await supabase.from('map_tokens').update({ hit_points: newHp }).eq('id', damageTarget.tokenId);
      }
    } else if (damageTarget.charId) {
      const char = characters.find(c => c.id === damageTarget.charId);
      if (char) {
        const newHp = Math.max(0, Math.min(char.hit_points, char.current_hp + amount));
        await supabase.from('character_sheets').update({ current_hp: newHp }).eq('id', damageTarget.charId);
        onRefresh?.();
      }
    }
    toast.success(`${isDamage ? 'Dano' : 'Cura'} de ${damageAmount} aplicado a ${damageTarget.name}!`);
    setDamageTarget(null);
    if (activeMap) fetchTokens(activeMap.id);
  };

  // Only master can drag tokens - players only view
  const canDragToken = (token: TokenRow) => {
    return isMaster;
  };

  const handleMouseDown = (e: React.MouseEvent, tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token || !canDragToken(token)) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingToken(tokenId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingToken && mapInnerRef.current) {
      const rect = mapInnerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setTokens(prev => prev.map(t => t.id === draggingToken ? { ...t, x_position: Math.max(0, Math.min(100, x)), y_position: Math.max(0, Math.min(100, y)) } : t));
      return;
    }
    if (isSelecting && mapInnerRef.current) {
      setSelectionEnd({ x: e.clientX, y: e.clientY });
      return;
    }
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [draggingToken, isPanning, panStart, isSelecting]);

  const handleMouseUp = useCallback(async () => {
    if (draggingToken) {
      const token = tokens.find(t => t.id === draggingToken);
      if (token) {
        await supabase.from('map_tokens').update({
          x_position: token.x_position, y_position: token.y_position,
        }).eq('id', draggingToken);
      }
      setDraggingToken(null);
    }
    if (isSelecting && mapInnerRef.current) {
      // Calculate selection rectangle and select tokens within it
      const rect = mapInnerRef.current.getBoundingClientRect();
      const x1 = Math.min(selectionStart.x, selectionEnd.x);
      const x2 = Math.max(selectionStart.x, selectionEnd.x);
      const y1 = Math.min(selectionStart.y, selectionEnd.y);
      const y2 = Math.max(selectionStart.y, selectionEnd.y);

      const selected = new Set<string>();
      tokens.forEach(token => {
        const tokenX = rect.left + (token.x_position / 100) * rect.width;
        const tokenY = rect.top + (token.y_position / 100) * rect.height;
        if (tokenX >= x1 && tokenX <= x2 && tokenY >= y1 && tokenY <= y2) {
          selected.add(token.id);
        }
      });
      setSelectedTokens(selected);
      setIsSelecting(false);
    }
    setIsPanning(false);
  }, [draggingToken, tokens, isSelecting, selectionStart, selectionEnd]);

  const handleMapMouseDown = (e: React.MouseEvent) => {
    if (!isMaster) return;
    if (draggingToken) return;
    // Right-click or shift+click for selection box
    if (e.shiftKey || e.button === 0) {
      // Check if clicking on empty space (not a token)
      const target = e.target as HTMLElement;
      const isToken = target.closest('[data-token]');
      if (!isToken && e.shiftKey) {
        setIsSelecting(true);
        setSelectionStart({ x: e.clientX, y: e.clientY });
        setSelectionEnd({ x: e.clientX, y: e.clientY });
        return;
      }
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.5, Math.min(3, prev - e.deltaY * 0.001)));
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const resizeTokens = async (delta: number) => {
    if (selectedTokens.size > 0) {
      // Resize selected tokens
      for (const tokenId of selectedTokens) {
        const token = tokens.find(t => t.id === tokenId);
        if (token) {
          const newSize = Math.max(20, Math.min(120, (token.token_size || 40) + delta));
          await supabase.from('map_tokens').update({ token_size: newSize }).eq('id', tokenId);
        }
      }
      setTokens(prev => prev.map(t => selectedTokens.has(t.id) ? { ...t, token_size: Math.max(20, Math.min(120, (t.token_size || 40) + delta)) } : t));
    }
  };

  const resizeSingleToken = async (tokenId: string, delta: number) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    const newSize = Math.max(20, Math.min(120, (token.token_size || 40) + delta));
    await supabase.from('map_tokens').update({ token_size: newSize }).eq('id', tokenId);
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, token_size: newSize } : t));
  };

  if (!activeMap) {
    return (
      <div className="flex h-full flex-col">
        {/* Player view: show other maps to browse */}
        {!isMaster && allMaps.length > 0 && (
          <div className="border-b border-border px-3 py-2 bg-card/50">
            <div className="flex items-center gap-2 flex-wrap">
              <Map className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-cinzel text-muted-foreground">Mapas disponíveis:</span>
              {allMaps.map(m => (
                <button key={m.id} onClick={() => setViewingMap(m)}
                  className={`rounded-sm border px-2 py-1 text-[10px] font-cinzel transition-colors ${m.is_active ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {m.name} {m.is_active && '★'}
                </button>
              ))}
            </div>
          </div>
        )}
        {isMaster && allMaps.length > 0 && (
          <div className="border-b border-border px-3 py-2 bg-card/50">
            <div className="flex items-center gap-2 flex-wrap">
              <Map className="h-3.5 w-3.5 text-gold" />
              <span className="text-[10px] font-cinzel text-muted-foreground">Ativar mapa:</span>
              {allMaps.map(m => (
                <button key={m.id} onClick={() => switchMap(m.id)}
                  className="rounded-sm border border-border px-2 py-1 text-[10px] font-cinzel text-muted-foreground hover:border-gold hover:text-gold transition-colors">
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-1 items-center justify-center">
          {viewingMap ? (
            <div className="w-full h-full p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-cinzel text-xs text-muted-foreground">{viewingMap.name}</span>
                <button onClick={() => setViewingMap(null)} className="text-[10px] text-muted-foreground hover:text-foreground">✕ Fechar</button>
              </div>
              <img src={viewingMap.image_url} alt={viewingMap.name} className="max-h-[80%] w-full object-contain rounded-sm border border-border" />
            </div>
          ) : (
            <div className="text-center space-y-6">
              <Users className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="font-cinzel text-lg text-muted-foreground">Aguardando o mestre carregar um mapa...</h3>
              <div className="flex flex-wrap justify-center gap-4 mt-6">
                {members.map(m => {
                  const char = characters.find(c => c.user_id === m.user_id);
                  const isOnline = m.is_online !== false;
                  return (
                    <div key={m.user_id} className={`flex flex-col items-center gap-2 transition-all ${!isOnline ? 'opacity-40 grayscale' : ''}`}>
                      <div className="relative">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/50 bg-secondary overflow-hidden">
                          {char?.icon_url ? (
                            <img src={char.icon_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="font-cinzel text-lg text-muted-foreground">{(char?.name || m.display_name)?.charAt(0)?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${isOnline ? 'bg-forest' : 'bg-muted-foreground'}`} />
                      </div>
                      <span className="text-xs font-cinzel text-muted-foreground">{char?.name || m.display_name}</span>
                      {m.role === 'master' && <span className="text-[9px] text-gold font-cinzel">Mestre</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-card/50 flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <span className="font-cinzel text-xs text-gold">{activeMap.name}</span>
          {isMaster && (
            <div className="relative">
              <button onClick={() => setShowMapSelector(!showMapSelector)}
                className="rounded-sm border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-gold hover:text-gold">
                <Map className="h-3 w-3" />
              </button>
              {showMapSelector && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-sm shadow-lg min-w-[120px]">
                  {allMaps.map(m => (
                    <button key={m.id} onClick={() => switchMap(m.id)}
                      className={`block w-full text-left px-3 py-1.5 text-[10px] font-cinzel transition-colors ${
                        m.id === activeMap.id ? 'text-gold bg-gold/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}>
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Player: view other maps */}
          {!isMaster && allMaps.length > 1 && (
            <div className="relative">
              <button onClick={() => setShowViewMaps(!showViewMaps)}
                className="rounded-sm border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground">
                <Map className="h-3 w-3" />
              </button>
              {showViewMaps && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-sm shadow-lg min-w-[120px]">
                  {allMaps.map(m => (
                    <button key={m.id} onClick={() => { setViewingMap(m); setShowViewMaps(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-[10px] font-cinzel transition-colors ${
                        m.is_active ? 'text-gold bg-gold/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}>
                      {m.name} {m.is_active && '★'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isMaster && (
            <>
              {/* Add Enemy/Player menu */}
              <div className="relative mr-2">
                <button onClick={() => setShowAddMenu(!showAddMenu)}
                  className="flex items-center gap-1 rounded-sm border border-gold bg-gold/10 px-2 py-1 text-[10px] font-cinzel text-gold hover:bg-gold/20">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
                {showAddMenu && (
                  <div className="absolute top-full right-0 mt-1 z-30 bg-card border border-border rounded-sm shadow-lg min-w-[200px] max-h-64 overflow-y-auto">
                    <div className="px-3 py-1.5 border-b border-border">
                      <span className="text-[9px] font-cinzel text-gold flex items-center gap-1"><UserPlus className="h-3 w-3" /> Jogadores</span>
                    </div>
                    {characters.length === 0 ? (
                      <div className="px-3 py-1.5 text-[10px] text-muted-foreground">Nenhuma ficha</div>
                    ) : (
                      characters.map(char => (
                        <button key={char.id} onClick={() => addPlayerToken(char)}
                          disabled={!!tokens.find(t => t.character_id === char.id)}
                          className="block w-full text-left px-3 py-1.5 text-[10px] font-cinzel text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-default">
                          {char.name} {tokens.find(t => t.character_id === char.id) ? '(no mapa)' : ''}
                        </button>
                      ))
                    )}
                    <div className="px-3 py-1.5 border-b border-t border-border">
                      <span className="text-[9px] font-cinzel text-blood flex items-center gap-1"><Skull className="h-3 w-3" /> Inimigos</span>
                    </div>
                    {enemies.length === 0 ? (
                      <div className="px-3 py-1.5 text-[10px] text-muted-foreground">Cadastre inimigos na aba Mapa</div>
                    ) : (
                      enemies.map(enemy => (
                        <button key={enemy.id} onClick={() => addEnemyToMap(enemy)}
                          className="block w-full text-left px-3 py-1.5 text-[10px] font-cinzel text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                          {enemy.name} <span className="text-blood">HP:{enemy.hit_points}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {/* Resize selected tokens */}
              {selectedTokens.size > 0 && (
                <div className="flex items-center gap-0.5 mr-1 border border-gold/30 rounded-sm px-1 bg-gold/5">
                  <Maximize2 className="h-2.5 w-2.5 text-gold" />
                  <span className="text-[8px] text-gold">{selectedTokens.size}</span>
                  <button onClick={() => resizeTokens(-5)} className="p-0.5 text-gold hover:text-gold-light"><Minus className="h-2.5 w-2.5" /></button>
                  <button onClick={() => resizeTokens(5)} className="p-0.5 text-gold hover:text-gold-light"><Plus className="h-2.5 w-2.5" /></button>
                  <button onClick={() => setSelectedTokens(new Set())} className="p-0.5 text-muted-foreground hover:text-foreground text-[8px]">✕</button>
                </div>
              )}
              <span className="text-[8px] text-muted-foreground mr-1">Shift+arrastar: selecionar</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-1 text-muted-foreground hover:text-gold"><ZoomIn className="h-3.5 w-3.5" /></button>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-1 text-muted-foreground hover:text-gold"><ZoomOut className="h-3.5 w-3.5" /></button>
              <button onClick={resetView} className="p-1 text-muted-foreground hover:text-gold"><RotateCcw className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </div>

      {/* Map area */}
      <div
        ref={mapContainerRef}
        className="relative flex-1 overflow-hidden bg-secondary/30"
        onMouseDown={handleMapMouseDown}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? 'grabbing' : (isMaster ? 'grab' : 'default') }}
      >
        {/* Viewing another map overlay (player) */}
        {viewingMap && viewingMap.id !== activeMap.id && (
          <div className="absolute inset-0 z-40 bg-background/90 flex flex-col items-center justify-center p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-cinzel text-sm text-muted-foreground">{viewingMap.name}</span>
              <button onClick={() => setViewingMap(null)} className="text-xs text-gold hover:text-gold-light font-cinzel">← Voltar à cena</button>
            </div>
            <img src={viewingMap.image_url} alt={viewingMap.name} className="max-h-[80%] max-w-full object-contain rounded-sm border border-border" />
          </div>
        )}

        {/* Selection rectangle */}
        {isSelecting && (
          <div className="fixed z-50 border-2 border-gold/60 bg-gold/10 pointer-events-none" style={{
            left: Math.min(selectionStart.x, selectionEnd.x),
            top: Math.min(selectionStart.y, selectionEnd.y),
            width: Math.abs(selectionEnd.x - selectionStart.x),
            height: Math.abs(selectionEnd.y - selectionStart.y),
          }} />
        )}

        <div
          ref={mapInnerRef}
          className="relative h-full w-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: draggingToken || isPanning || isSelecting ? 'none' : 'transform 0.2s',
          }}
        >
          <img src={activeMap.image_url} alt={activeMap.name} className="h-full w-full object-contain" draggable={false} />

          {/* Tokens */}
          {tokens.map(token => {
            const linkedChar = token.character_id ? characters.find(c => c.id === token.character_id) : null;
            const currentHp = token.token_type === 'enemy' ? token.hit_points : linkedChar?.current_hp;
            const maxHp = token.token_type === 'enemy' ? token.max_hit_points : linkedChar?.hit_points;
            const size = token.token_size || 40;
            const isSelected = selectedTokens.has(token.id);

            return (
              <div
                key={token.id}
                data-token
                className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 ${canDragToken(token) ? 'cursor-grab' : ''} ${draggingToken === token.id ? 'cursor-grabbing z-20' : 'z-10'} ${isSelected ? 'ring-2 ring-gold ring-offset-1 ring-offset-transparent rounded-full' : ''}`}
                style={{ left: `${token.x_position}%`, top: `${token.y_position}%` }}
                onMouseDown={e => handleMouseDown(e, token.id)}
                onClick={e => { if (!draggingToken) { e.stopPropagation(); handleTokenClick(token); } }}
              >
                <div className={`flex items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg ${
                  token.token_type === 'enemy'
                    ? 'border-blood bg-blood/80 text-foreground'
                    : 'border-gold bg-gold/80 text-primary-foreground'
                }`} style={{ width: size, height: size }}>
                  {token.icon_url ? (
                    <img src={token.icon_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    token.name?.charAt(0)?.toUpperCase() || '?'
                  )}
                </div>
                <span className={`mt-0.5 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[9px] font-cinzel shadow ${
                  token.token_type === 'enemy' ? 'bg-blood/90 text-foreground' : 'bg-gold/90 text-primary-foreground'
                }`}>
                  {token.name}
                </span>
                {maxHp && maxHp > 0 && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <div className="h-1.5 w-14 rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${token.token_type === 'enemy' ? 'bg-blood' : 'bg-forest'}`}
                        style={{ width: `${((currentHp || 0) / maxHp) * 100}%` }} />
                    </div>
                    <span className="text-[8px] text-foreground">{currentHp}/{maxHp}</span>
                  </div>
                )}
                {/* Master: inline resize + remove */}
                {isMaster && (
                  <div className="mt-0.5 flex items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); resizeSingleToken(token.id, -5); }} className="text-[8px] text-muted-foreground hover:text-gold"><Minus className="h-2 w-2" /></button>
                    <button onClick={(e) => { e.stopPropagation(); resizeSingleToken(token.id, 5); }} className="text-[8px] text-muted-foreground hover:text-gold"><Plus className="h-2 w-2" /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeToken(token.id); }} className="text-[8px] text-muted-foreground hover:text-destructive ml-0.5">
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Damage/Heal modal */}
      <AnimatePresence>
        {damageTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-background/60"
            onClick={() => setDamageTarget(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="card-medieval p-5 w-64 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-blood" />
                <h3 className="font-cinzel text-sm text-foreground">{damageTarget.name}</h3>
              </div>
              <input type="number" min={1} value={damageAmount} onChange={e => setDamageAmount(Number(e.target.value))}
                className="w-full rounded-sm border border-border bg-input px-3 py-2 text-center text-sm text-foreground focus:border-gold focus:outline-none"
                placeholder="Valor" autoFocus />
              <div className="flex gap-2">
                <button onClick={() => applyDamageOrHeal(true)}
                  className="flex-1 rounded-sm border border-blood bg-blood/10 py-1.5 font-cinzel text-xs text-blood hover:bg-blood/20">
                  Dano
                </button>
                <button onClick={() => applyDamageOrHeal(false)}
                  className="flex-1 rounded-sm border border-forest bg-forest/10 py-1.5 font-cinzel text-xs text-forest hover:bg-forest/20">
                  Cura
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SceneView;
