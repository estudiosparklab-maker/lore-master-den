import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Crown, UserPlus, Trash2, Shield, Sword, Users, Mail, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserData {
  user_id: string;
  display_name: string;
  role: AppRole;
  email?: string;
  last_sign_in_at?: string | null;
}

const AdminDashboard = () => {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('player');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    const [profilesRes, rolesRes, authRes] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.functions.invoke('admin-users', { method: 'GET' }),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const authUsers: Array<{ id: string; email: string; last_sign_in_at: string | null }> = authRes.data?.users || [];

    const merged: UserData[] = profiles.map(p => {
      const authUser = authUsers.find(u => u.id === p.user_id);
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        role: roles.find(r => r.user_id === p.user_id)?.role || 'player',
        email: authUser?.email,
        last_sign_in_at: authUser?.last_sign_in_at,
      };
    });
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName) return;
    setCreating(true);

    const { data: result, error } = await supabase.functions.invoke('create-user', {
      body: { email: newEmail, password: newPassword, display_name: newName, role: newRole },
    });

    if (error || result?.error) {
      toast.error('Erro ao criar usuário: ' + (result?.error || error?.message));
      setCreating(false);
      return;
    }

    toast.success(`Aventureiro "${newName}" cadastrado como ${newRole}!`);
    setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('player');
    setShowForm(false); setCreating(false);
    fetchUsers();
  };

  const updateRole = async (userId: string, newRole: AppRole) => {
    const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
    if (error) toast.error('Erro ao atualizar papel');
    else { toast.success('Papel atualizado!'); fetchUsers(); }
  };

  const deleteUser = async (userId: string, displayName: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${displayName}"? Esta ação é irreversível.`)) return;
    setDeletingId(userId);

    const { data, error } = await supabase.functions.invoke('admin-users', {
      method: 'DELETE',
      body: { user_id: userId },
    });

    if (error || data?.error) {
      toast.error('Erro ao excluir: ' + (data?.error || error?.message));
    } else {
      toast.success(`"${displayName}" foi removido do reino.`);
      fetchUsers();
    }
    setDeletingId(null);
  };

  if (role !== 'admin') {
    return <AppLayout><div className="text-center text-muted-foreground font-cinzel mt-20">Acesso negado. Apenas administradores.</div></AppLayout>;
  }

  const roleIcon = (r: AppRole) => {
    switch (r) {
      case 'admin': return <Crown className="h-4 w-4 text-gold" />;
      case 'master': return <Shield className="h-4 w-4 text-accent" />;
      case 'player': return <Sword className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AppLayout requiredRole="admin">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-cinzel text-2xl text-gold-gradient">Administração do Reino</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gerencie os aventureiros do reino</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-sm border border-gold bg-gold/10 px-4 py-2 font-cinzel text-sm text-gold transition-all hover:bg-gold/20">
            <UserPlus className="h-4 w-4" /> Novo Aventureiro
          </button>
        </div>

        {showForm && (
          <div className="card-medieval mb-6 p-6">
            <h2 className="mb-4 font-cinzel text-lg text-foreground">Cadastrar Aventureiro</h2>
            <form onSubmit={handleCreateUser} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Nome</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} required
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" placeholder="Nome do aventureiro" />
              </div>
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Email</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" placeholder="email@exemplo.com" />
              </div>
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Senha</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="mb-1 block font-cinzel text-xs text-muted-foreground">Papel</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as AppRole)}
                  className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
                  <option value="player">Jogador</option>
                  <option value="master">Mestre</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={creating}
                  className="rounded-sm border border-gold bg-gold/10 px-6 py-2 font-cinzel text-sm text-gold hover:bg-gold/20 disabled:opacity-50">
                  {creating ? 'Criando...' : 'Cadastrar'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-sm border border-border px-6 py-2 font-cinzel text-sm text-muted-foreground hover:bg-secondary">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card-medieval overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              <h2 className="font-cinzel text-lg text-foreground">Aventureiros ({users.length})</h2>
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    {roleIcon(u.role)}
                    <div>
                      <p className="font-cinzel text-sm text-foreground">{u.display_name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{u.role === 'admin' ? 'Administrador' : u.role === 'master' ? 'Mestre' : 'Jogador'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {u.email && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Mail className="h-3 w-3" /> {u.email}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> {formatDate(u.last_sign_in_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={u.role} onChange={e => updateRole(u.user_id, e.target.value as AppRole)}
                      className="rounded-sm border border-border bg-input px-3 py-1.5 text-xs text-foreground focus:border-gold focus:outline-none">
                      <option value="player">Jogador</option>
                      <option value="master">Mestre</option>
                      <option value="admin">Administrador</option>
                    </select>
                    {u.role !== 'admin' && (
                      <button onClick={() => deleteUser(u.user_id, u.display_name)}
                        disabled={deletingId === u.user_id}
                        className="rounded-sm border border-destructive/50 p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50"
                        title="Excluir usuário">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum aventureiro cadastrado ainda.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
