import { motion } from 'framer-motion'
import { Crown, Database } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ClusterNode } from '@/mocks/metrics'

interface ClusterStatusProps {
  nodes: ClusterNode[]
}

const NODE_POSITIONS = [
  { x: 50, y: 18 },
  { x: 15, y: 75 },
  { x: 85, y: 75 },
]

const FLOW_PATHS = [
  { d: 'M 50 26 L 22 67', id: 'flow-1' },
  { d: 'M 50 26 L 78 67', id: 'flow-2' },
]

export function ClusterStatus({ nodes }: ClusterStatusProps) {
  const primary = nodes.find((n) => n.role === 'primary')
  const replicas = nodes.filter((n) => n.role === 'replica')

  return (
    <div className="space-y-4">
      {/* SVG constellation */}
      <div className="relative w-full" style={{ paddingBottom: '68%' }}>
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          fill="none"
          aria-label="Cluster PostgreSQL HA — 3 nodos"
          role="img"
        >
          {/* Connection lines */}
          {FLOW_PATHS.map((path) => (
            <g key={path.id}>
              {/* Static base line */}
              <path
                d={path.d}
                stroke="var(--color-border)"
                strokeWidth="0.8"
              />
              {/* Animated data-flow dash */}
              <motion.path
                d={path.d}
                stroke="var(--color-primary)"
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeDasharray="3 5"
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -24 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                opacity={0.7}
              />
            </g>
          ))}

          {/* Nodes */}
          {nodes.map((node, i) => {
            const pos = NODE_POSITIONS[i]
            const isPrimary = node.role === 'primary'
            const isUp = node.status === 'UP'

            return (
              <g key={node.id}>
                {/* Outer ring glow for primary */}
                {isPrimary && (
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r="9.5"
                    stroke="var(--color-primary)"
                    strokeWidth="0.5"
                    fill="none"
                    opacity={0.4}
                    animate={{ r: [9.5, 11, 9.5], opacity: [0.4, 0.1, 0.4] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}

                {/* Node circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="8.5"
                  fill={isPrimary ? 'var(--color-primary)' : 'var(--color-surface-alt)'}
                  stroke={isPrimary ? 'var(--color-primary-deep)' : 'var(--color-border)'}
                  strokeWidth="0.8"
                />

                {/* Status dot */}
                <circle
                  cx={pos.x + 6}
                  cy={pos.y - 6}
                  r="2.2"
                  fill={isUp ? 'var(--color-success)' : 'var(--color-danger)'}
                  stroke="var(--color-surface)"
                  strokeWidth="0.8"
                />

                {/* Icon area (text abbreviation) */}
                <text
                  x={pos.x}
                  y={pos.y + 1.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="bold"
                  fill={isPrimary ? 'white' : 'var(--color-muted)'}
                >
                  {isPrimary ? 'PRI' : 'REP'}
                </text>

                {/* Node label */}
                <text
                  x={pos.x}
                  y={pos.y + 13.5}
                  textAnchor="middle"
                  fontSize="3.5"
                  fontFamily="JetBrains Mono, monospace"
                  fill="var(--color-muted)"
                >
                  {node.id}
                </text>

                {/* Replica lag */}
                {!isPrimary && (
                  <text
                    x={pos.x}
                    y={pos.y + 17.5}
                    textAnchor="middle"
                    fontSize="3"
                    fontFamily="JetBrains Mono, monospace"
                    fill="var(--color-accent)"
                  >
                    lag: {node.lagMs}ms
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Node legend */}
      <div className="grid grid-cols-3 gap-2">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={cn(
              'rounded-lg p-2 text-center space-y-0.5 border',
              node.role === 'primary'
                ? 'bg-primary-soft border-primary/30'
                : 'bg-surface-alt border-border',
            )}
          >
            <div className="flex items-center justify-center gap-1">
              {node.role === 'primary' ? (
                <Crown className="h-3 w-3 text-primary" />
              ) : (
                <Database className="h-3 w-3 text-muted" />
              )}
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wide',
                  node.role === 'primary' ? 'text-primary-deep' : 'text-muted',
                )}
              >
                {node.role === 'primary' ? 'Primary' : 'Replica'}
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted">{node.id}</p>
            <div className="flex items-center justify-center gap-1">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  node.status === 'UP' ? 'bg-success' : 'bg-danger animate-pulse',
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-mono',
                  node.status === 'UP' ? 'text-success' : 'text-danger',
                )}
              >
                {node.status}
              </span>
            </div>
            {node.role !== 'primary' && (
              <p className="text-[10px] font-mono text-accent">lag {node.lagMs}ms</p>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-xs font-mono text-muted pt-1 border-t border-border">
        <span>
          Primary:{' '}
          <span className="text-ink font-semibold">{primary?.id ?? '—'}</span>
        </span>
        <span>
          Réplicas activas:{' '}
          <span className="text-success font-semibold">
            {replicas.filter((r) => r.status === 'UP').length}/{replicas.length}
          </span>
        </span>
      </div>
    </div>
  )
}
