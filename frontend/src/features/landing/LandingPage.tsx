import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Zap, Bell, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'

const STACK_BADGES = [
  'Spring Boot 3', 'PostgreSQL HA', 'Patroni', 'RabbitMQ',
  'HAProxy', 'Docker Compose', 'React 18', 'Prometheus + Grafana',
]

const FEATURES = [
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: 'Tu pedido siempre llega',
    description:
      'Alta disponibilidad con tres nodos de base de datos y failover automático. Si un servidor falla, otro toma el control en segundos.',
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Procesamos miles a la vez',
    description:
      'Mensajería asíncrona con RabbitMQ. Cada pedido se procesa en paralelo sin bloquear al siguiente. Probado con 50,000 órdenes concurrentes.',
  },
  {
    icon: <Bell className="h-6 w-6" />,
    title: 'Te avisamos en cada paso',
    description:
      'Seguimiento en tiempo real desde que haces el pedido hasta que está en tu puerta. Sin perder ningún evento, incluso ante fallos de red.',
  },
]

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center bg-ink overflow-hidden px-6">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />

        {/* Radial glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Logo size="xl" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="space-y-4"
          >
            <h1 className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-none text-[#E7E2D9]">
              Pedidos que{' '}
              <span className="text-primary relative inline-block">
                no se pierden
                <svg
                  className="absolute -bottom-1 left-0 w-full"
                  height="4"
                  viewBox="0 0 100 4"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M0 3 Q25 1 50 3 Q75 5 100 2"
                    stroke="#DC2626"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              .{' '}
              <span className="text-[#E7E2D9]">Nunca.</span>
            </h1>

            <p className="text-lg text-[#A8A29E] max-w-xl mx-auto leading-relaxed">
              Sistema de pedidos de alta disponibilidad con tolerancia a fallos,
              procesamiento asíncrono y observabilidad en tiempo real.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/menu')}
              rightIcon={<ArrowRight className="h-5 w-5" />}
              className="shadow-warm-lg"
            >
              Ver menú
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate('/admin')}
              className="text-[#A8A29E] hover:text-[#E7E2D9] hover:bg-white/5"
            >
              Panel de observabilidad
            </Button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          aria-hidden="true"
        >
          <div className="w-5 h-8 rounded-full border border-[#A8A29E]/30 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-[#A8A29E]/50" />
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="bg-surface px-6 py-20">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="font-display font-extrabold text-3xl text-ink">
              Diseñado para no fallar
            </h2>
            <p className="text-muted max-w-lg mx-auto">
              Tres garantías que cualquier sistema de pedidos necesita.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl bg-surface-alt border border-border p-6 space-y-4 hover:shadow-warm-md transition-shadow"
              >
                <div className="h-12 w-12 rounded-xl bg-primary-soft flex items-center justify-center text-primary">
                  {feature.icon}
                </div>
                <h3 className="font-display font-bold text-lg text-ink">{feature.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack section */}
      <section className="bg-surface-alt border-t border-border px-6 py-16">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-mono text-muted uppercase tracking-widest">
              Para el catedrático — Base de Datos II
            </p>
            <h2 className="font-display font-bold text-2xl text-ink">
              Arquitectura de alta disponibilidad
            </h2>
            <p className="text-sm text-muted max-w-xl mx-auto">
              Replicación maestro-réplica con Patroni y etcd, failover automático,
              mensajería asíncrona con patrón Outbox, y observabilidad completa con
              Prometheus y Grafana.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {STACK_BADGES.map((badge) => (
              <span
                key={badge}
                className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold bg-surface border border-border text-muted hover:border-primary/40 hover:text-ink transition-colors cursor-default"
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
              Ver métricas en vivo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/kitchen')}>
              Dashboard de cocina
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
