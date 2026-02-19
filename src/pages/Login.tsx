import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import heroBanner from '@/assets/hero-banner.jpg';
import { Shield, Sword } from 'lucide-react';

const Login = () => {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const redirectTo = (location.state as any)?.redirect || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="animate-torch-flicker text-gold text-xl font-cinzel">Carregando...</div></div>;
  if (user) return <Navigate to={redirectTo} replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) setError('Credenciais inválidas. Contacte o administrador.');
    setSubmitting(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 opacity-20">
        <img src={heroBanner} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="card-medieval p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center gap-2">
              <Shield className="h-8 w-8 text-gold" />
              <Sword className="h-8 w-8 text-gold" />
            </div>
            <h1 className="font-decorative text-2xl text-gold-gradient">
              Velho Reino Esquecido
            </h1>
            <p className="mt-2 font-body text-muted-foreground">
              Que os ventos do destino guiem seus passos
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-1.5 block font-cinzel text-sm text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-sm border border-border bg-input px-4 py-2.5 font-body text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-cinzel text-sm text-foreground">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-sm border border-border bg-input px-4 py-2.5 font-body text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-sm border border-gold bg-gold/10 px-4 py-2.5 font-cinzel text-sm font-semibold text-gold transition-all hover:bg-gold/20 hover:shadow-[0_0_20px_rgba(180,140,60,0.2)] disabled:opacity-50"
            >
              {submitting ? 'Entrando...' : 'Entrar no Reino'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Contas são criadas pelo Administrador do reino.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
