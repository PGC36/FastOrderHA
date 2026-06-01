import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppRole = 'cliente' | 'cocina' | 'entrega' | 'admin'

export const ROLE_LABELS: Record<AppRole, string> = {
  cliente: 'Cliente',
  cocina: 'Cocina',
  entrega: 'Entrega',
  admin: 'Administrador',
}

interface RoleState {
  role: AppRole
  setRole: (role: AppRole) => void
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      role: 'cliente',
      setRole: (role) => set({ role }),
    }),
    { name: 'fastorder-role' },
  ),
)
