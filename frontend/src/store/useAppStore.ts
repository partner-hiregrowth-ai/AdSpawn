import { create } from 'zustand';
import { User, AdAccount } from '../types';

interface AppState {
  user: User | null;
  adAccounts: AdAccount[];
  selectedAccount: AdAccount | null;
  sidebarCollapsed: boolean;
  setUser: (user: User | null) => void;
  setAdAccounts: (accounts: AdAccount[]) => void;
  setSelectedAccount: (account: AdAccount | null) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  adAccounts: [],
  selectedAccount: null,
  sidebarCollapsed: false,
  setUser: (user) => set({ user }),
  setAdAccounts: (accounts) => set({ adAccounts: accounts }),
  setSelectedAccount: (account) => set({ selectedAccount: account }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
