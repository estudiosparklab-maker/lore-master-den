import { ReactNode, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { Shield, LogOut, Crown, Gamepad2, PanelLeftClose, PanelLeft } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'master' | 'player';
  collapsedSidebar?: boolean;
}

const AppLayout = ({ children, requiredRole, collapsedSidebar = false }: AppLayoutProps) => {
  const { user, role, profile, loading, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(collapsedSidebar);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="animate-torch-flicker text-gold text-xl font-cinzel">Carregando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;

  const navItems = [
    { to: '/dashboard', label: 'Mesas', icon: Gamepad2, roles: ['admin', 'master', 'player'] },
    ...(role === 'admin' ? [{ to: '/admin', label: 'Administração', icon: Crown, roles: ['admin'] }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={`sticky top-0 flex h-screen flex-col border-r border-border bg-card transition-all duration-300 ${collapsed ? 'w-14' : 'w-64'}`}>
        <div className="flex items-center justify-between border-b border-border p-3">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-gold" />
              <h1 className="font-decorative text-sm text-gold-gradient">Velho Reino</h1>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-gold transition-colors p-1">
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-sm px-3 py-2.5 font-cinzel text-sm transition-colors ${
                  active
                    ? 'border-ornate bg-secondary text-gold'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          {!collapsed && (
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/30 bg-secondary font-cinzel text-xs text-gold shrink-0">
                {profile?.display_name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{profile?.display_name}</p>
                <p className="text-xs capitalize text-muted-foreground">{role}</p>
              </div>
            </div>
          )}
          <button
            onClick={signOut}
            title={collapsed ? 'Sair' : undefined}
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
