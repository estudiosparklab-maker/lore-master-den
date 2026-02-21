import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Plus, Trash2, Edit3, Save, X, Users } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';

type CharacterSheetRow = Tables<'character_sheets'>;

interface JournalEntry {
  id: string;
  table_id: string;
  title: string;
  content: string;
  character_ids: string[];
  created_at: string;
  updated_at: string;
}

interface Props {
  tableId: string;
  isMaster: boolean;
  characters: CharacterSheetRow[];
}

const Journal = ({ tableId, isMaster, characters }: Props) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('table_id', tableId)
      .order('created_at', { ascending: false });
    if (data) setEntries(data as JournalEntry[]);
  };

  useEffect(() => { fetchEntries(); }, [tableId]);

  useEffect(() => {
    const channel = supabase
      .channel(`journal-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries', filter: `table_id=eq.${tableId}` }, () => fetchEntries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId]);

  const toggleChar = (charId: string) => {
    setSelectedChars(prev => prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId]);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Dê um título à entrada'); return; }

    if (editingId) {
      await supabase.from('journal_entries').update({
        title: title.trim(),
        content: content.trim(),
        character_ids: selectedChars,
        updated_at: new Date().toISOString(),
      }).eq('id', editingId);
      toast.success('Entrada atualizada!');
    } else {
      await supabase.from('journal_entries').insert({
        table_id: tableId,
        title: title.trim(),
        content: content.trim(),
        character_ids: selectedChars,
      });
      toast.success('Entrada adicionada ao jornal!');
    }

    resetForm();
    fetchEntries();
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setSelectedChars(entry.character_ids || []);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('journal_entries').delete().eq('id', id);
    toast.success('Entrada removida');
    fetchEntries();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setContent('');
    setSelectedChars([]);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const getCharName = (id: string) => characters.find(c => c.id === id)?.name || 'Desconhecido';

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-gold" />
            <h2 className="font-decorative text-2xl text-gold-gradient">Crônicas da Aventura</h2>
          </div>
          {isMaster && !showForm && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-sm border border-gold bg-gold/10 px-3 py-1.5 font-cinzel text-xs text-gold hover:bg-gold/20 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Nova Entrada
            </button>
          )}
        </div>

        {/* Form */}
        <AnimatePresence>
          {showForm && isMaster && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="card-medieval p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-cinzel text-sm text-gold">{editingId ? 'Editar Entrada' : 'Nova Crônica'}</h3>
                <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do acontecimento..."
                className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground font-cinzel focus:border-gold focus:outline-none" />
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Descreva os eventos desta sessão..."
                rows={6}
                className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground italic focus:border-gold focus:outline-none" />

              {/* Character tags */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 font-cinzel text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> Personagens envolvidos
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {characters.map(char => (
                    <button key={char.id} onClick={() => toggleChar(char.id)}
                      className={`flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-cinzel transition-colors border ${
                        selectedChars.includes(char.id)
                          ? 'border-gold bg-gold/20 text-gold'
                          : 'border-border text-muted-foreground hover:border-gold/50'
                      }`}>
                      {char.icon_url && <img src={char.icon_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />}
                      {char.name}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleSave}
                className="flex items-center gap-1.5 rounded-sm border border-gold bg-gold/10 px-4 py-2 font-cinzel text-sm text-gold hover:bg-gold/20 transition-colors">
                <Save className="h-3.5 w-3.5" /> {editingId ? 'Atualizar' : 'Registrar'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Entries */}
        {entries.length === 0 ? (
          <div className="card-medieval p-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-cinzel text-muted-foreground">As crônicas aguardam o início da jornada...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry, i) => (
              <motion.div key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-medieval overflow-hidden"
              >
                <div className="p-5 cursor-pointer" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-gold/60 font-cinzel tracking-widest uppercase">{formatDate(entry.created_at)}</p>
                      <h3 className="mt-1 font-decorative text-lg text-gold-gradient">{entry.title}</h3>
                    </div>
                    {isMaster && (
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleEdit(entry)} className="p-1 text-muted-foreground hover:text-gold"><Edit3 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDelete(entry.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>

                  {/* Character tags */}
                  {entry.character_ids && entry.character_ids.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.character_ids.map(cid => (
                        <span key={cid} className="rounded-sm border border-gold/20 bg-gold/5 px-1.5 py-0.5 text-[9px] font-cinzel text-gold">
                          {getCharName(cid)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Preview or full content */}
                  {expandedId === entry.id ? (
                    <p className="mt-3 text-sm text-foreground italic whitespace-pre-wrap leading-relaxed border-t border-border/50 pt-3">
                      {entry.content}
                    </p>
                  ) : entry.content && (
                    <p className="mt-2 text-sm text-muted-foreground italic line-clamp-2">{entry.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Journal;
