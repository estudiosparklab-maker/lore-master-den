import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X, Save, Heart, Sparkles, Coins, Swords, Shield, BookOpen, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';
import parchmentBg from '@/assets/parchment-bg.jpg';

type CharacterSheetRow = Tables<'character_sheets'>;

interface Props {
  character: CharacterSheetRow;
  isMaster: boolean;
  maxLevel: number;
  onClose: () => void;
  onUpdate: () => void;
}

const CharacterSheet = ({ character, isMaster, maxLevel, onClose, onUpdate }: Props) => {
  const { user } = useAuth();
  const isOwner = user?.id === character.user_id;
  const canEdit = isOwner || isMaster;
  const [data, setData] = useState<any>({ ...character });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'attributes' | 'equipment' | 'backpack'>('info');

  // XP/Level system: level = floor(xp / 100), capped at maxLevel
  const calculatedLevel = Math.min(Math.floor((data.xp || 0) / 100), maxLevel);
  const xpForNextLevel = (calculatedLevel + 1) * 100;
  const xpProgress = ((data.xp || 0) % 100);

  const update = (field: string, value: any) => {
    setData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { id, created_at, table_id, user_id, ...updateData } = data;
    // Auto-calculate level from XP
    updateData.level = calculatedLevel;

    // If player (not master), strip gold/xp/level fields
    if (isOwner && !isMaster) {
      delete updateData.gold;
      delete updateData.silver;
      delete updateData.copper;
      delete updateData.xp;
      delete updateData.level;
    }

    const { error } = await supabase.from('character_sheets').update(updateData).eq('id', character.id);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else { toast.success('Ficha salva!'); onUpdate(); }
    setSaving(false);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file);
    if (error) { toast.error('Erro no upload'); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    update('icon_url', urlData.publicUrl);
    toast.success('Ícone atualizado! Salve a ficha.');
  };

  const NumberField = ({ label, field, min = 0, max, masterOnly = false }: { label: string; field: string; min?: number; max?: number; masterOnly?: boolean }) => {
    const editable = masterOnly ? isMaster : canEdit;
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-sm text-foreground">{label}</span>
        {editable ? (
          <input type="number" value={data[field]} onChange={e => update(field, Number(e.target.value))}
            min={min} max={max}
            className="w-16 rounded-sm border border-border bg-input px-2 py-1 text-center text-sm text-foreground focus:border-gold focus:outline-none" />
        ) : (
          <span className="font-bold text-sm text-gold">{data[field]}</span>
        )}
      </div>
    );
  };

  const TextField = ({ label, field }: { label: string; field: string }) => (
    <div>
      <label className="mb-1 block font-cinzel text-xs text-muted-foreground">{label}</label>
      {canEdit ? (
        <input value={data[field] || ''} onChange={e => update(field, e.target.value)}
          className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
      ) : (
        <p className="text-sm text-foreground">{data[field] || '—'}</p>
      )}
    </div>
  );

  const tabs = [
    { key: 'info' as const, label: 'Informações', icon: BookOpen },
    { key: 'attributes' as const, label: 'Atributos', icon: Swords },
    { key: 'equipment' as const, label: 'Equipamento', icon: Shield },
    { key: 'backpack' as const, label: 'Mochila', icon: Sparkles },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-sm"
          onClick={e => e.stopPropagation()}
        >
          <div className="relative border-ornate bg-card">
            <div className="absolute inset-0 opacity-5 rounded-sm overflow-hidden">
              <img src={parchmentBg} alt="" className="h-full w-full object-cover" />
            </div>

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-border p-6">
                <div className="flex items-center gap-4">
                  {/* Character icon */}
                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold/30 bg-secondary overflow-hidden">
                      {data.icon_url ? (
                        <img src={data.icon_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl font-cinzel text-muted-foreground">{data.name?.charAt(0)}</span>
                      )}
                    </div>
                    {canEdit && (
                      <label className="absolute -bottom-1 -right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-gold bg-card text-gold hover:bg-gold/20">
                        <Upload className="h-2.5 w-2.5" />
                        <input type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                  <div>
                    <p className="font-cinzel text-xs text-muted-foreground tracking-widest">REGISTRO DE AVENTUREIRO</p>
                    <h2 className="mt-1 font-decorative text-xl text-gold-gradient">{data.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.race} • {data.class} • Nível {calculatedLevel}
                      {data.alignment_law && data.alignment_moral && ` • ${data.alignment_law} ${data.alignment_moral}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-1 rounded-sm border border-gold bg-gold/10 px-3 py-1.5 font-cinzel text-xs text-gold hover:bg-gold/20 disabled:opacity-50">
                      <Save className="h-3 w-3" /> {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  )}
                  <button onClick={onClose} className="rounded-sm p-1.5 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 font-cinzel text-xs transition-colors ${
                      tab === t.key ? 'border-b-2 border-gold text-gold' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {tab === 'info' && (
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Nome" field="name" />
                      <TextField label="Idade" field="age" />
                      <TextField label="Altura" field="height" />
                      <TextField label="Peso" field="weight" />
                      <div>
                        <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Raça</label>
                        {canEdit ? (
                          <select value={data.race || ''} onChange={e => update('race', e.target.value || null)}
                            className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
                            <option value="">Selecionar...</option>
                            {['Humano','Elfo','Anão','Fada','Homem Réptil','Draconiano','Orc','Ogro','Besta','Elemental'].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : <p className="text-sm text-foreground">{data.race || '—'}</p>}
                      </div>
                      <div>
                        <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Classe</label>
                        {canEdit ? (
                          <select value={data.class || ''} onChange={e => update('class', e.target.value || null)}
                            className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
                            <option value="">Selecionar...</option>
                            {['Guerreiro','Assassino','Paladino','Monge','Arqueiro','Engenheiro','Mago','Feiticeiro','Bruxo','Necromante','Xamã','Bárbaro','Caçador','Pirata/Ladrão','Cavaleiro'].map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : <p className="text-sm text-foreground">{data.class || '—'}</p>}
                      </div>
                      <div>
                        <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Alinhamento (Lei)</label>
                        {canEdit ? (
                          <select value={data.alignment_law || ''} onChange={e => update('alignment_law', e.target.value)}
                            className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
                            <option value="">Selecionar...</option>
                            {['Caótico','Neutro','Leal'].map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        ) : <p className="text-sm text-foreground">{data.alignment_law || '—'}</p>}
                      </div>
                      <div>
                        <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Alinhamento (Moral)</label>
                        {canEdit ? (
                          <select value={data.alignment_moral || ''} onChange={e => update('alignment_moral', e.target.value)}
                            className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
                            <option value="">Selecionar...</option>
                            {['Bom','Neutro','Mau'].map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        ) : <p className="text-sm text-foreground">{data.alignment_moral || '—'}</p>}
                      </div>
                    </div>

                    {/* Health & Treasure */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="card-medieval p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Heart className="h-4 w-4 text-blood" />
                          <h3 className="font-cinzel text-sm text-foreground">Saúde</h3>
                        </div>
                        <NumberField label="HP Total" field="hit_points" />
                        <NumberField label="HP Atual" field="current_hp" />
                        <div className="mt-2">
                          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-blood rounded-full transition-all" style={{ width: `${data.hit_points > 0 ? (data.current_hp / data.hit_points) * 100 : 0}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 text-center">{data.current_hp} / {data.hit_points}</p>
                        </div>
                        <NumberField label="Constituição" field="constitution" />
                        <NumberField label="Mana/Energia" field="mana" />
                      </div>
                      <div className="card-medieval p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Coins className="h-4 w-4 text-gold" />
                          <h3 className="font-cinzel text-sm text-foreground">Tesouros</h3>
                        </div>
                        <NumberField label="Ouro" field="gold" masterOnly />
                        <NumberField label="Prata" field="silver" masterOnly />
                        <NumberField label="Cobre" field="copper" masterOnly />
                      </div>
                    </div>

                    {/* Level & XP */}
                    <div className="card-medieval p-4">
                      <h3 className="font-cinzel text-sm text-foreground mb-3">Nível & Experiência</h3>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-foreground">Nível</span>
                        <span className="font-bold text-sm text-gold">{calculatedLevel}</span>
                      </div>
                      <NumberField label="Experiência (XP)" field="xp" masterOnly />
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Nv {calculatedLevel} → {calculatedLevel + 1}</span>
                          <span>{data.xp || 0} / {xpForNextLevel} XP</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* History */}
                    <div>
                      <label className="mb-1 block font-cinzel text-xs text-muted-foreground">História</label>
                      {canEdit ? (
                        <textarea value={data.history || ''} onChange={e => update('history', e.target.value)}
                          rows={4}
                          className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none italic"
                          placeholder="Que os ventos do destino guiem seus passos..." />
                      ) : <p className="text-sm text-foreground italic">{data.history || '—'}</p>}
                    </div>
                  </div>
                )}

                {tab === 'attributes' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="card-medieval p-4">
                      <h3 className="font-cinzel text-sm text-foreground mb-3">Atributos</h3>
                      <NumberField label="Força" field="strength" />
                      <NumberField label="Defesa" field="defense" />
                      <NumberField label="Resistência" field="resistance" />
                      <NumberField label="Inteligência" field="intelligence" />
                      <NumberField label="Sabedoria" field="wisdom" />
                      <NumberField label="Furtividade" field="stealth" />
                      <NumberField label="Reflexos" field="reflexes" />
                      <NumberField label="Carisma" field="charisma" />
                    </div>
                    <div className="card-medieval p-4">
                      <h3 className="font-cinzel text-sm text-foreground mb-3">Habilidades</h3>
                      <NumberField label="Armas de corte leves" field="light_cutting_weapons" />
                      <NumberField label="Armas de corte pesadas" field="heavy_cutting_weapons" />
                      <NumberField label="Arcos curtos" field="short_bows" />
                      <NumberField label="Arcos longos" field="long_bows" />
                      <NumberField label="Lanças" field="spears" />
                      <NumberField label="Armaduras" field="armor" />
                      <NumberField label="Cavalos" field="horses" />
                      <NumberField label="Armadilhas" field="traps" />
                      <NumberField label="Poções" field="potions" />
                      <NumberField label="Outros" field="others" />
                    </div>
                  </div>
                )}

                {tab === 'equipment' && (
                  <div className="space-y-4">
                    <h3 className="font-cinzel text-sm text-foreground">Equipamentos</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Mão Esquerda" field="left_hand" />
                      <TextField label="Mão Direita" field="right_hand" />
                      <TextField label="Botas" field="boots" />
                      <TextField label="Costas" field="back" />
                      <TextField label="Torso" field="torso" />
                      <TextField label="Pernas" field="legs" />
                      <TextField label="Cintura" field="belt" />
                    </div>
                  </div>
                )}

                {tab === 'backpack' && (
                  <div className="space-y-6">
                    <div className="card-medieval p-4">
                      <h3 className="font-cinzel text-sm text-foreground mb-3">Mochila</h3>
                      <NumberField label="Carga Máxima" field="backpack_max_load" />
                      <div className="mt-3">
                        <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Itens (um por linha)</label>
                        {canEdit ? (
                          <textarea
                            value={(data.backpack_items || []).join('\n')}
                            onChange={e => update('backpack_items', e.target.value.split('\n').filter(Boolean))}
                            rows={5}
                            className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                            placeholder="Corda de cânhamo&#10;Tocha&#10;Ração de viagem" />
                        ) : (
                          <ul className="text-sm text-foreground space-y-1">
                            {(data.backpack_items || []).map((item: string, i: number) => <li key={i}>• {item}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="card-medieval p-4">
                      <h3 className="font-cinzel text-sm text-foreground mb-3">Montaria</h3>
                      <TextField label="Nome da Montaria" field="mount_name" />
                      <div className="mt-2"><NumberField label="Carga Máxima" field="mount_max_load" /></div>
                      <div className="mt-3">
                        <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Itens na Montaria (um por linha)</label>
                        {canEdit ? (
                          <textarea
                            value={(data.mount_items || []).join('\n')}
                            onChange={e => update('mount_items', e.target.value.split('\n').filter(Boolean))}
                            rows={3}
                            className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
                        ) : (
                          <ul className="text-sm text-foreground space-y-1">
                            {(data.mount_items || []).map((item: string, i: number) => <li key={i}>• {item}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CharacterSheet;
