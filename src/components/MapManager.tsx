import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Map, Upload, Trash2, Eye, Skull, X } from 'lucide-react';
import { toast } from 'sonner';

interface MapRow {
  id: string;
  table_id: string;
  name: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
}

interface Props {
  tableId: string;
}

const MapManager = ({ tableId }: Props) => {
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [mapName, setMapName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showEnemyForm, setShowEnemyForm] = useState(false);
  const [enemyName, setEnemyName] = useState('');
  const [enemyHp, setEnemyHp] = useState(10);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);

  const fetchMaps = async () => {
    const { data } = await supabase.from('table_maps').select('*').eq('table_id', tableId).order('created_at');
    if (data) {
      setMaps(data as MapRow[]);
      const active = (data as MapRow[]).find(m => m.is_active);
      if (active) setActiveMapId(active.id);
    }
  };

  useEffect(() => { fetchMaps(); }, [tableId]);

  useEffect(() => {
    const channel = supabase
      .channel(`map-mgr-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_maps', filter: `table_id=eq.${tableId}` }, () => fetchMaps())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId]);

  const uploadMap = async (file: File) => {
    if (!mapName.trim()) { toast.error('Dê um nome ao mapa'); return; }
    setUploading(true);
    const path = `${tableId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('maps').upload(path, file);
    if (uploadErr) { toast.error('Erro no upload'); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('maps').getPublicUrl(path);
    await supabase.from('table_maps').update({ is_active: false }).eq('table_id', tableId);

    const { error } = await supabase.from('table_maps').insert({
      table_id: tableId,
      name: mapName.trim(),
      image_url: urlData.publicUrl,
      is_active: true,
    });

    if (error) toast.error('Erro ao salvar mapa');
    else { toast.success('Mapa adicionado!'); setMapName(''); fetchMaps(); }
    setUploading(false);
  };

  const activateMap = async (map: MapRow) => {
    await supabase.from('table_maps').update({ is_active: false }).eq('table_id', tableId);
    await supabase.from('table_maps').update({ is_active: true }).eq('id', map.id);
    setActiveMapId(map.id);
    toast.success(`Mapa "${map.name}" ativo`);
  };

  const deleteMap = async (mapId: string) => {
    await supabase.from('table_maps').delete().eq('id', mapId);
    fetchMaps();
    toast.success('Mapa removido');
  };

  const addEnemyToken = async () => {
    if (!activeMapId || !enemyName.trim()) { toast.error('Selecione um mapa ativo e dê um nome'); return; }
    await supabase.from('map_tokens').insert({
      map_id: activeMapId,
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
    toast.success('Inimigo adicionado ao mapa!');
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Map className="h-5 w-5 text-gold" />
        <h2 className="font-cinzel text-lg text-foreground">Gerenciar Mapas</h2>
      </div>

      {/* Upload form */}
      <div className="card-medieval p-4 space-y-3">
        <h3 className="font-cinzel text-sm text-gold flex items-center gap-2"><Upload className="h-4 w-4" /> Novo Mapa</h3>
        <input value={mapName} onChange={e => setMapName(e.target.value)} placeholder="Nome do mapa"
          className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
        <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadMap(e.target.files[0])}
          className="w-full text-xs text-muted-foreground file:mr-2 file:rounded-sm file:border file:border-gold file:bg-gold/10 file:px-3 file:py-1.5 file:font-cinzel file:text-xs file:text-gold" />
        {uploading && <p className="text-xs text-gold">Enviando...</p>}
      </div>

      {/* Map list */}
      <div className="card-medieval p-4">
        <h3 className="font-cinzel text-sm text-foreground mb-3">Mapas ({maps.length})</h3>
        {maps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum mapa ainda.</p>
        ) : (
          <div className="space-y-2">
            {maps.map(map => (
              <div key={map.id} className={`flex items-center justify-between rounded-sm border p-3 transition-colors ${
                map.id === activeMapId ? 'border-gold bg-gold/5' : 'border-border'
              }`}>
                <div className="flex items-center gap-3">
                  <img src={map.image_url} alt={map.name} className="h-10 w-16 rounded-sm object-cover border border-border" />
                  <div>
                    <span className="font-cinzel text-sm text-foreground">{map.name}</span>
                    {map.id === activeMapId && <span className="ml-2 text-[10px] text-gold font-cinzel">(ativo)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {map.id !== activeMapId && (
                    <button onClick={() => activateMap(map)} className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-gold hover:border-gold" title="Ativar">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteMap(map.id)} className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive" title="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enemy creator */}
      <div className="card-medieval p-4 space-y-3">
        <button onClick={() => setShowEnemyForm(!showEnemyForm)}
          className="flex items-center gap-2 font-cinzel text-sm text-gold hover:text-foreground transition-colors">
          <Skull className="h-4 w-4" /> {showEnemyForm ? 'Fechar' : 'Criar Inimigo'}
        </button>
        {showEnemyForm && (
          <div className="space-y-2 pt-2">
            <input value={enemyName} onChange={e => setEnemyName(e.target.value)} placeholder="Nome do inimigo"
              className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground font-cinzel">HP:</span>
              <input type="number" value={enemyHp} onChange={e => setEnemyHp(Number(e.target.value))} min={1}
                className="w-24 rounded-sm border border-border bg-input px-3 py-2 text-sm text-center text-foreground focus:border-gold focus:outline-none" />
              <button onClick={addEnemyToken}
                className="rounded-sm border border-gold bg-gold/10 px-4 py-2 font-cinzel text-sm text-gold hover:bg-gold/20">
                Adicionar
              </button>
            </div>
            {!activeMapId && <p className="text-xs text-destructive">Ative um mapa antes de adicionar inimigos</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapManager;
