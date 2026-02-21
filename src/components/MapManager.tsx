import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Map, Upload, Trash2, Eye, Skull, X, Plus, Image } from 'lucide-react';
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
  const [showMapForm, setShowMapForm] = useState(false);
  const [showEnemyForm, setShowEnemyForm] = useState(false);
  const [mapName, setMapName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [enemyName, setEnemyName] = useState('');
  const [enemyHp, setEnemyHp] = useState(10);
  const [enemyIconFile, setEnemyIconFile] = useState<File | null>(null);
  const [enemyIconPreview, setEnemyIconPreview] = useState<string | null>(null);
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
      table_id: tableId, name: mapName.trim(), image_url: urlData.publicUrl, is_active: true,
    });

    if (error) toast.error('Erro ao salvar mapa');
    else { toast.success('Mapa adicionado!'); setMapName(''); setShowMapForm(false); fetchMaps(); }
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

  const handleEnemyIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEnemyIconFile(file);
      setEnemyIconPreview(URL.createObjectURL(file));
    }
  };

  const addEnemyToken = async () => {
    if (!activeMapId || !enemyName.trim()) { toast.error('Selecione um mapa ativo e dê um nome'); return; }

    let iconUrl: string | null = null;
    if (enemyIconFile) {
      const path = `${tableId}/enemies/${Date.now()}_${enemyIconFile.name}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, enemyIconFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        iconUrl = urlData.publicUrl;
      }
    }

    await supabase.from('map_tokens').insert({
      map_id: activeMapId, token_type: 'enemy', name: enemyName.trim(),
      hit_points: enemyHp, max_hit_points: enemyHp,
      icon_url: iconUrl, x_position: 50, y_position: 50,
    });
    setEnemyName(''); setEnemyHp(10); setEnemyIconFile(null); setEnemyIconPreview(null);
    setShowEnemyForm(false);
    toast.success('Inimigo adicionado ao mapa!');
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-gold" />
          <h2 className="font-cinzel text-lg text-foreground">Gerenciar Mapas</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowMapForm(!showMapForm); setShowEnemyForm(false); }}
            className="flex items-center gap-1.5 rounded-sm border border-gold bg-gold/10 px-3 py-1.5 font-cinzel text-xs text-gold hover:bg-gold/20 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Cadastrar Mapa
          </button>
          <button onClick={() => { setShowEnemyForm(!showEnemyForm); setShowMapForm(false); }}
            className="flex items-center gap-1.5 rounded-sm border border-blood bg-blood/10 px-3 py-1.5 font-cinzel text-xs text-blood hover:bg-blood/20 transition-colors">
            <Skull className="h-3.5 w-3.5" /> Cadastrar Inimigo
          </button>
        </div>
      </div>

      {/* Upload map form */}
      {showMapForm && (
        <div className="card-medieval p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-cinzel text-sm text-gold flex items-center gap-2"><Upload className="h-4 w-4" /> Novo Mapa</h3>
            <button onClick={() => setShowMapForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <input value={mapName} onChange={e => setMapName(e.target.value)} placeholder="Nome do mapa"
            className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
          <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadMap(e.target.files[0])}
            className="w-full text-xs text-muted-foreground file:mr-2 file:rounded-sm file:border file:border-gold file:bg-gold/10 file:px-3 file:py-1.5 file:font-cinzel file:text-xs file:text-gold" />
          {uploading && <p className="text-xs text-gold">Enviando...</p>}
        </div>
      )}

      {/* Enemy form */}
      {showEnemyForm && (
        <div className="card-medieval p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-cinzel text-sm text-blood flex items-center gap-2"><Skull className="h-4 w-4" /> Novo Inimigo</h3>
            <button onClick={() => setShowEnemyForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blood/30 bg-secondary overflow-hidden shrink-0">
              {enemyIconPreview ? (
                <img src={enemyIconPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <Skull className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <label className="flex items-center gap-1 cursor-pointer rounded-sm border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-blood hover:text-blood transition-colors">
              <Image className="h-3 w-3" /> Ícone
              <input type="file" accept="image/*" onChange={handleEnemyIcon} className="hidden" />
            </label>
          </div>
          <input value={enemyName} onChange={e => setEnemyName(e.target.value)} placeholder="Nome do inimigo"
            className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-cinzel">HP:</span>
            <input type="number" value={enemyHp} onChange={e => setEnemyHp(Number(e.target.value))} min={1}
              className="w-24 rounded-sm border border-border bg-input px-3 py-2 text-sm text-center text-foreground focus:border-gold focus:outline-none" />
            <button onClick={addEnemyToken}
              className="rounded-sm border border-blood bg-blood/10 px-4 py-2 font-cinzel text-sm text-blood hover:bg-blood/20">
              Adicionar
            </button>
          </div>
          {!activeMapId && <p className="text-xs text-destructive">Ative um mapa antes de adicionar inimigos</p>}
        </div>
      )}

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
    </div>
  );
};

export default MapManager;
