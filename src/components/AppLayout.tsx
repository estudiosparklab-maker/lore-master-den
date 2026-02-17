import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { Shield, Sword, Users, ScrollText, LogOut, Crown, Gamepad2 } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'master' | 'player';
}

const AppLayout = ({ children, requiredRole }: AppLayoutProps) => {
  const { user, role, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="animate-torch-flicker text-gold text-xl font-cinzel">Carregando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;

  const navItems = [
    { to: '/dashboard', label: 'Mesas', icon: Gamepad2, roles: ['admin', 'master', 'player'] },
    ...(role === 'admin' ? [{ to: '/admin', label: 'Administração', icon: Crown, roles: ['admin'] }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gold" />
            <h1 className="font-decorative text-sm text-gold-gradient">Velho Reino</h1>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-sm px-3 py-2.5 font-cinzel text-sm transition-colors ${
                  active
                    ? 'border-ornate bg-secondary text-gold'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/30 bg-secondary font-cinzel text-xs text-gold">
              {profile?.display_name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{profile?.display_name}</p>
              <p className="text-xs capitalize text-muted-foreground">{role}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
