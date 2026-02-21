import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Send, Dices } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type CharacterSheetRow = Tables<'character_sheets'>;

interface Message {
  id: string;
  user_id: string;
  display_name: string;
  message: string;
  created_at: string;
}

interface DiceRoll {
  id: string;
  character_name: string | null;
  num_dice: number;
  num_faces: number;
  results: number[];
  total: number;
  created_at: string;
  user_id: string;
}

type FeedItem =
  | { type: 'message'; data: Message }
  | { type: 'dice'; data: DiceRoll };

interface Props {
  tableId: string;
  characters?: CharacterSheetRow[];
}

const TableChat = ({ tableId, characters = [] }: Props) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [diceRolls, setDiceRolls] = useState<DiceRoll[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('table_messages')
      .select('*')
      .eq('table_id', tableId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) setMessages(data as Message[]);
  };

  const fetchDiceRolls = async () => {
    const { data } = await supabase
      .from('dice_rolls')
      .select('*')
      .eq('table_id', tableId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) setDiceRolls(data as DiceRoll[]);
  };

  useEffect(() => { fetchMessages(); fetchDiceRolls(); }, [tableId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, diceRolls]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${tableId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'table_messages', filter: `table_id=eq.${tableId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dice_rolls', filter: `table_id=eq.${tableId}` }, (payload) => {
        setDiceRolls(prev => [...prev, payload.new as DiceRoll]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId]);

  const feed: FeedItem[] = [
    ...messages.map(m => ({ type: 'message' as const, data: m })),
    ...diceRolls.map(d => ({ type: 'dice' as const, data: d })),
  ].sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());

  const getCharacterName = (userId: string) => {
    const char = characters.find(c => c.user_id === userId);
    return char?.name || null;
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setSending(true);

    await supabase.from('table_messages').insert({
      table_id: tableId,
      user_id: user.id,
      display_name: profile?.display_name || 'Aventureiro',
      message: text.trim(),
    });

    setText('');
    setSending(false);
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="card-medieval flex flex-col" style={{ height: '400px' }}>
      <div className="flex items-center gap-2 border-b border-border p-3">
        <MessageSquare className="h-4 w-4 text-gold" />
        <h3 className="font-cinzel text-sm text-foreground">Chat da Mesa</h3>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {feed.map(item => {
          if (item.type === 'dice') {
            const roll = item.data as DiceRoll;
            return (
              <div key={`dice-${roll.id}`} className="flex justify-center">
                <div className="flex items-center gap-1.5 rounded-sm bg-gold/5 border border-gold/20 px-3 py-1.5 text-xs">
                  <Dices className="h-3 w-3 text-gold" />
                  <span className="text-gold font-cinzel font-bold">{roll.character_name || 'Anônimo'}</span>
                  <span className="text-muted-foreground">rolou</span>
                  <span className="text-foreground font-cinzel">{roll.num_dice}D{roll.num_faces}</span>
                  <span className="text-muted-foreground">[{roll.results?.join(', ')}]</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-gold font-bold text-sm">{roll.total}</span>
                  <span className="text-muted-foreground/50 text-[9px] ml-1">{formatTime(roll.created_at)}</span>
                </div>
              </div>
            );
          }

          const msg = item.data as Message;
          const charName = getCharacterName(msg.user_id);
          const isMe = msg.user_id === user?.id;
          return (
            <div key={`msg-${msg.id}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1">
                {charName ? (
                  <>
                    <span className="text-[10px] text-gold font-cinzel font-bold">{charName}</span>
                    <span className="text-[9px] text-muted-foreground">({msg.display_name})</span>
                  </>
                ) : (
                  <span className="text-[10px] text-gold font-cinzel font-bold">{msg.display_name}</span>
                )}
                <span className="text-[9px] text-muted-foreground">• {formatTime(msg.created_at)}</span>
              </div>
              <div className={`max-w-[80%] rounded-sm px-3 py-1.5 text-sm ${
                isMe
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'bg-secondary text-foreground border border-border'
              }`}>
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 border-t border-border p-3">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Enviar mensagem..."
          className="flex-1 rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
        />
        <button type="submit" disabled={sending || !text.trim()}
          className="rounded-sm border border-gold bg-gold/10 px-3 py-2 text-gold hover:bg-gold/20 disabled:opacity-50 transition-colors">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export default TableChat;
