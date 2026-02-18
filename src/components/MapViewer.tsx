import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Map, Plus, Upload, Trash2, Eye, Skull, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
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

interface Props {
  tableId: string;
  isMaster: boolean;
  characters: CharacterSheetRow[];
}

const MapViewer = ({ tableId, isMaster, characters }: Props) => {
  const { user } = useAuth();
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [activeMap, setActiveMap] = useState<MapRow | null>(null);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showEnemyForm, setShowEnemyForm] = useState(false);
  const [mapName, setMapName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [enemyName, setEnemyName] = useState('');
  const [enemyHp, setEnemyHp] = useState(10);
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const fetchMaps = async () => {
    const { data } = await supabase.from('table_maps').select('*').eq('table_id', tableId).order('created_at');
    if (data) {
      setMaps(data as MapRow[]);
      const active = (data as MapRow[]).find(m => m.is_active);
      if (active) setActiveMap(active);
      else if (data.length > 0) setActiveMap(data[0] as MapRow);
    }
  };

  const fetchTokens = async (mapId: string) => {
    const { data } = await supabase.from('map_tokens').select('*').eq('map_id', mapId);
    if (data) setTokens(data as TokenRow[]);
  };

  useEffect(() => { fetchMaps(); }, [tableId]);
  useEffect(() => { if (activeMap) fetchTokens(activeMap.id); }, [activeMap?.id]);

  // Realtime for maps and tokens
  useEffect(() => {
    const channel = supabase
      .channel(`maps-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_maps', filter: `table_id=eq.${tableId}` }, () => fetchMaps())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId]);

  useEffect(() => {
    if (!activeMap) return;
    const channel = supabase
      .channel(`tokens-${activeMap.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_tokens', filter: `map_id=eq.${activeMap.id}` }, () => fetchTokens(activeMap.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeMap?.id]);

  const uploadMap = async (file: File) => {
    if (!mapName.trim()) { toast.error('Dê um nome ao mapa'); return; }
    setUploading(true);
    const path = `${tableId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('maps').upload(path, file);
    if (uploadErr) { toast.error('Erro no upload'); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('maps').getPublicUrl(path);

    // Deactivate other maps
    await supabase.from('table_maps').update({ is_active: false }).eq('table_id', tableId);

    const { error } = await supabase.from('table_maps').insert({
      table_id: tableId,
      name: mapName.trim(),
      image_url: urlData.publicUrl,
      is_active: true,
    });

    if (error) toast.error('Erro ao salvar mapa');
    else { toast.success('Mapa adicionado!'); setMapName(''); setShowUpload(false); fetchMaps(); }
    setUploading(false);
  };

  const activateMap = async (map: MapRow) => {
    await supabase.from('table_maps').update({ is_active: false }).eq('table_id', tableId);
    await supabase.from('table_maps').update({ is_active: true }).eq('id', map.id);
    setActiveMap(map);
  };

  const deleteMap = async (mapId: string) => {
    await supabase.from('table_maps').delete().eq('id', mapId);
    if (activeMap?.id === mapId) setActiveMap(null);
    fetchMaps();
    toast.success('Mapa removido');
  };

  const addPlayerToken = async (char: CharacterSheetRow) => {
    if (!activeMap) return;
    // Check if token already exists
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

  const addEnemyToken = async () => {
    if (!activeMap || !enemyName.trim()) return;
    await supabase.from('map_tokens').insert({
      map_id: activeMap.id,
      token_type: 'enemy',
      name: enemyName.trim(),
      hit_points: enemyHp,
      max_hit_points: enemyHp,
      x_position: 50,
      y_position: 50,
    });
    setEnemyName('');
    setEnemyHp(10);
    setShowEnemyForm(false);
    fetchTokens(activeMap.id);
    toast.success('Inimigo adicionado!');
  };

  const removeToken = async (tokenId: string) => {
    await supabase.from('map_tokens').delete().eq('id', tokenId);
    fetchTokens(activeMap!.id);
  };

  const updateEnemyHp = async (tokenId: string, newHp: number) => {
    await supabase.from('map_tokens').update({ hit_points: Math.max(0, newHp) }).eq('id', tokenId);
    fetchTokens(activeMap!.id);
  };

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent, tokenId: string) => {
    if (!isMaster) return;
    e.preventDefault();
    setDraggingToken(tokenId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingToken || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTokens(prev => prev.map(t => t.id === draggingToken ? { ...t, x_position: Math.max(0, Math.min(100, x)), y_position: Math.max(0, Math.min(100, y)) } : t));
  }, [draggingToken]);

  const handleMouseUp = useCallback(async () => {
    if (!draggingToken) return;
    const token = tokens.find(t => t.id === draggingToken);
    if (token) {
      await supabase.from('map_tokens').update({
        x_position: token.x_position,
        y_position: token.y_position,
      }).eq('id', draggingToken);
    }
    setDraggingToken(null);
  }, [draggingToken, tokens]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="card-medieval p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-gold" />
          <h3 className="font-cinzel text-sm text-foreground">Mapa</h3>
        </div>
        {isMaster && (
          <div className="flex gap-1">
            <button onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] font-cinzel text-muted-foreground hover:border-gold hover:text-gold transition-colors">
              <Upload className="h-3 w-3" /> Upload
            </button>
            <button onClick={() => setShowEnemyForm(!showEnemyForm)}
              className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] font-cinzel text-muted-foreground hover:border-gold hover:text-gold transition-colors">
              <Skull className="h-3 w-3" /> Inimigo
            </button>
          </div>
        )}
      </div>

      {/* Map upload form */}
      {showUpload && isMaster && (
        <div className="mb-3 space-y-2 rounded-sm border border-border p-3 bg-secondary/50">
          <input value={mapName} onChange={e => setMapName(e.target.value)} placeholder="Nome do mapa"
            className="w-full rounded-sm border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none" />
          <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadMap(e.target.files[0])}
            className="w-full text-xs text-muted-foreground file:mr-2 file:rounded-sm file:border file:border-gold file:bg-gold/10 file:px-3 file:py-1 file:font-cinzel file:text-xs file:text-gold" />
          {uploading && <p className="text-xs text-gold">Enviando...</p>}
        </div>
      )}

      {/* Enemy form */}
      {showEnemyForm && isMaster && (
        <div className="mb-3 space-y-2 rounded-sm border border-border p-3 bg-secondary/50">
          <input value={enemyName} onChange={e => setEnemyName(e.target.value)} placeholder="Nome do inimigo"
            className="w-full rounded-sm border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">HP:</span>
            <input type="number" value={enemyHp} onChange={e => setEnemyHp(Number(e.target.value))} min={1}
              className="w-20 rounded-sm border border-border bg-input px-2 py-1.5 text-sm text-center text-foreground focus:border-gold focus:outline-none" />
            <button onClick={addEnemyToken}
              className="rounded-sm border border-gold bg-gold/10 px-3 py-1.5 font-cinzel text-xs text-gold hover:bg-gold/20">
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Map selector tabs */}
      {maps.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {maps.map(map => (
            <div key={map.id} className="flex items-center gap-1">
              <button onClick={() => { activateMap(map); }}
                className={`rounded-sm px-2 py-1 text-[10px] font-cinzel transition-colors ${
                  activeMap?.id === map.id ? 'bg-gold/20 text-gold border border-gold' : 'border border-border text-muted-foreground hover:text-foreground'
                }`}>
                {map.name}
              </button>
              {isMaster && (
                <button onClick={() => deleteMap(map.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add player tokens */}
      {isMaster && activeMap && characters.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          <span className="text-[10px] text-muted-foreground font-cinzel self-center mr-1">Adicionar:</span>
          {characters.map(char => (
            <button key={char.id} onClick={() => addPlayerToken(char)}
              className="rounded-sm border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-gold hover:text-gold transition-colors">
              {char.name}
            </button>
          ))}
        </div>
      )}

      {/* Map display */}
      {activeMap ? (
        <div ref={mapContainerRef} className="relative w-full overflow-hidden rounded-sm border border-border" style={{ aspectRatio: '16/9' }}>
          <img src={activeMap.image_url} alt={activeMap.name} className="h-full w-full object-cover" draggable={false} />

          {/* Tokens */}
          {tokens.map(token => (
            <div
              key={token.id}
              className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 ${isMaster ? 'cursor-grab' : ''} ${draggingToken === token.id ? 'cursor-grabbing z-20' : 'z-10'}`}
              style={{ left: `${token.x_position}%`, top: `${token.y_position}%` }}
              onMouseDown={e => handleMouseDown(e, token.id)}
            >
              {/* Token circle */}
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
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
              {/* Name label */}
              <span className={`mt-0.5 whitespace-nowrap rounded-sm px-1 text-[8px] font-cinzel ${
                token.token_type === 'enemy' ? 'bg-blood/80 text-foreground' : 'bg-gold/80 text-primary-foreground'
              }`}>
                {token.name}
              </span>
              {/* HP bar for enemies */}
              {token.token_type === 'enemy' && token.max_hit_points && token.max_hit_points > 0 && (
                <div className="mt-0.5 flex items-center gap-1">
                  <div className="h-1.5 w-12 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-blood rounded-full transition-all" style={{ width: `${((token.hit_points || 0) / token.max_hit_points) * 100}%` }} />
                  </div>
                  {isMaster && (
                    <div className="flex gap-0.5">
                      <button onClick={() => updateEnemyHp(token.id, (token.hit_points || 0) - 1)} className="text-[8px] text-blood hover:text-foreground">-</button>
                      <span className="text-[8px] text-foreground">{token.hit_points}</span>
                      <button onClick={() => updateEnemyHp(token.id, (token.hit_points || 0) + 1)} className="text-[8px] text-forest hover:text-foreground">+</button>
                    </div>
                  )}
                </div>
              )}
              {/* Remove button for master */}
              {isMaster && (
                <button onClick={() => removeToken(token.id)} className="mt-0.5 text-[8px] text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-sm border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground font-cinzel">
            {isMaster ? 'Faça upload de um mapa para começar' : 'Aguardando o mestre carregar um mapa...'}
          </p>
        </div>
      )}
    </div>
  );
};

export default MapViewer;
