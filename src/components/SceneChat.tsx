import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Send } from 'lucide-react';

interface Message {
  id: string;
  user_id: string;
  display_name: string;
  message: string;
  created_at: string;
}

interface Props {
  tableId: string;
}

const SceneChat = ({ tableId }: Props) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const { data } = await supabase.from('table_messages').select('*').eq('table_id', tableId).order('created_at', { ascending: true }).limit(100);
    if (data) setMessages(data as Message[]);
  };

  useEffect(() => { fetchMessages(); }, [tableId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`scene-chat-${tableId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'table_messages', filter: `table_id=eq.${tableId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId]);

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
    <div className="flex h-full flex-col bg-card/50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare className="h-4 w-4 text-gold" />
        <h3 className="font-cinzel text-sm text-foreground">Chat da Mesa</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.user_id === user?.id ? 'justify-end' : ''}`}>
            <div className={`max-w-[85%] ${msg.user_id === user?.id ? 'order-2' : ''}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] text-gold font-cinzel font-bold">{msg.display_name}</span>
                <span className="text-[9px] text-muted-foreground">{formatTime(msg.created_at)}</span>
              </div>
              <div className={`rounded-sm px-3 py-1.5 text-sm ${
                msg.user_id === user?.id
                  ? 'bg-gold/10 text-foreground border border-gold/20'
                  : 'bg-secondary text-foreground border border-border'
              }`}>
                {msg.message}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
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

export default SceneChat;
