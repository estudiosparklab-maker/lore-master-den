import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trash2, ZoomIn, ZoomOut, RotateCcw, Users } from 'lucide-react';
import { toast } from 'sonner';
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
}

const SceneView = ({ tableId, isMaster, characters, members }: Props) => {
  const { user } = useAuth();
  const [activeMap, setActiveMap] = useState<MapRow | null>(null);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInnerRef = useRef<HTMLDivElement>(null);

  const myCharacter = characters.find(c => c.user_id === user?.id);

  const fetchActiveMap = async () => {
    const { data } = await supabase.from('table_maps').select('*').eq('table_id', tableId).eq('is_active', true).maybeSingle();
    if (data) setActiveMap(data as MapRow);
    else setActiveMap(null);
  };

  const fetchTokens = async (mapId: string) => {
    const { data } = await supabase.from('map_tokens').select('*').eq('map_id', mapId);
    if (data) setTokens(data as TokenRow[]);
  };

  useEffect(() => { fetchActiveMap(); }, [tableId]);
  useEffect(() => { if (activeMap) fetchTokens(activeMap.id); else setTokens([]); }, [activeMap?.id]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`scene-maps-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_maps', filter: `table_id=eq.${tableId}` }, () => fetchActiveMap())
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

  // Player self-add to map
  const addMyToken = async () => {
    if (!activeMap || !myCharacter) return;
    const existing = tokens.find(t => t.character_id === myCharacter.id);
    if (existing) { toast.info('Você já está no mapa'); return; }

    await supabase.from('map_tokens').insert({
      map_id: activeMap.id,
      token_type: 'player',
      character_id: myCharacter.id,
      name: myCharacter.name,
      icon_url: myCharacter.icon_url || null,
      x_position: 50,
      y_position: 50,
    });
    fetchTokens(activeMap.id);
    toast.success('Você entrou no mapa!');
  };

  // Master add player token
  const addPlayerToken = async (char: CharacterSheetRow) => {
    if (!activeMap) return;
    const existing = tokens.find(t => t.character_id === char.id);
    if (existing) { toast.info('Jogador já está no mapa'); return; }

    await supabase.from('map_tokens').insert({
      map_id: activeMap.id,
      token_type: 'player',
      character_id: char.id,
      name: char.name,
      icon_url: char.icon_url || null,
      x_position: 50,
      y_position: 50,
    });
    fetchTokens(activeMap.id);
  };

  const removeToken = async (tokenId: string) => {
    await supabase.from('map_tokens').delete().eq('id', tokenId);
    if (activeMap) fetchTokens(activeMap.id);
  };

  const updateEnemyHp = async (tokenId: string, newHp: number) => {
    await supabase.from('map_tokens').update({ hit_points: Math.max(0, newHp) }).eq('id', tokenId);
    if (activeMap) fetchTokens(activeMap.id);
  };

  // Can this user drag this token?
  const canDragToken = (token: TokenRow) => {
    if (isMaster) return true;
    if (token.token_type === 'player' && token.character_id && myCharacter && token.character_id === myCharacter.id) return true;
    return false;
  };

  // Drag handling
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
    if (isPanning && isMaster) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [draggingToken, isPanning, panStart, isMaster]);

  const handleMouseUp = useCallback(async () => {
    if (draggingToken) {
      const token = tokens.find(t => t.id === draggingToken);
      if (token) {
        await supabase.from('map_tokens').update({
          x_position: token.x_position,
          y_position: token.y_position,
        }).eq('id', draggingToken);
      }
      setDraggingToken(null);
    }
    setIsPanning(false);
  }, [draggingToken, tokens]);

  const handleMapMouseDown = (e: React.MouseEvent) => {
    if (isMaster && !draggingToken) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isMaster) return;
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

  // No map - show players
  if (!activeMap) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-6">
          <Users className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="font-cinzel text-lg text-muted-foreground">Aguardando o mestre carregar um mapa...</h3>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {members.map(m => {
              const char = characters.find(c => c.user_id === m.user_id);
              const isOnline = m.is_online !== false; // default to true
              return (
                <div key={m.user_id} className={`flex flex-col items-center gap-2 ${!isOnline ? 'opacity-40 grayscale' : ''}`}>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/50 bg-secondary overflow-hidden">
                    {char?.icon_url ? (
                      <img src={char.icon_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-cinzel text-lg text-muted-foreground">{(char?.name || m.display_name)?.charAt(0)?.toUpperCase()}</span>
                    )}
                  </div>
                  <span className="text-xs font-cinzel text-muted-foreground">{char?.name || m.display_name}</span>
                  {m.role === 'master' && <span className="text-[9px] text-gold font-cinzel">Mestre</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-card/50">
        <span className="font-cinzel text-xs text-gold">{activeMap.name}</span>
        <div className="flex items-center gap-1">
          {/* Player self-join */}
          {!isMaster && myCharacter && !tokens.find(t => t.character_id === myCharacter.id) && (
            <button onClick={addMyToken} className="rounded-sm border border-gold bg-gold/10 px-2 py-1 text-[10px] font-cinzel text-gold hover:bg-gold/20 mr-2">
              Entrar no mapa
            </button>
          )}
          {/* Master: add players */}
          {isMaster && characters.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              <span className="text-[10px] text-muted-foreground font-cinzel">Add:</span>
              {characters.map(char => (
                <button key={char.id} onClick={() => addPlayerToken(char)}
                  className="rounded-sm border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-gold hover:text-gold transition-colors">
                  {char.name}
                </button>
              ))}
            </div>
          )}
          {isMaster && (
            <>
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
        <div
          ref={mapInnerRef}
          className="relative h-full w-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: draggingToken || isPanning ? 'none' : 'transform 0.2s',
          }}
        >
          <img src={activeMap.image_url} alt={activeMap.name} className="h-full w-full object-contain" draggable={false} />

          {/* Tokens */}
          {tokens.map(token => (
            <div
              key={token.id}
              className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 ${canDragToken(token) ? 'cursor-grab' : ''} ${draggingToken === token.id ? 'cursor-grabbing z-20' : 'z-10'}`}
              style={{ left: `${token.x_position}%`, top: `${token.y_position}%` }}
              onMouseDown={e => handleMouseDown(e, token.id)}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg ${
                token.token_type === 'enemy'
                  ? 'border-blood bg-blood/80 text-foreground'
                  : 'border-gold bg-gold/80 text-primary-foreground'
              }`}>
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
              {/* HP bar for enemies */}
              {token.token_type === 'enemy' && token.max_hit_points && token.max_hit_points > 0 && (
                <div className="mt-0.5 flex items-center gap-1">
                  <div className="h-1.5 w-14 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-blood rounded-full transition-all" style={{ width: `${((token.hit_points || 0) / token.max_hit_points) * 100}%` }} />
                  </div>
                  {isMaster && (
                    <div className="flex gap-0.5">
                      <button onClick={(e) => { e.stopPropagation(); updateEnemyHp(token.id, (token.hit_points || 0) - 1); }} className="text-[9px] text-blood hover:text-foreground">-</button>
                      <span className="text-[9px] text-foreground">{token.hit_points}</span>
                      <button onClick={(e) => { e.stopPropagation(); updateEnemyHp(token.id, (token.hit_points || 0) + 1); }} className="text-[9px] text-forest hover:text-foreground">+</button>
                    </div>
                  )}
                </div>
              )}
              {/* Remove */}
              {isMaster && (
                <button onClick={(e) => { e.stopPropagation(); removeToken(token.id); }} className="mt-0.5 text-[8px] text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SceneView;
