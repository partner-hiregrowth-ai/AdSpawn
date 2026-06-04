import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, AdAccount, Team } from '../types';
import { useEffect, useState } from 'react';

export interface Profile {
  id: string;
  name: string;
  teamId: string;
  _count?: { draftCampaigns: number };
}

interface AppState {
  user: User | null;
  team: Team | null;
  profile: Profile | null;
  profiles: Profile[];
  adAccounts: AdAccount[];
  selectedAccount: AdAccount | null;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  draftName: string | null;
  tokenExpiresAt: string | null;
  setUser: (user: User | null) => void;
  setTeam: (team: Team | null) => void;
  setProfile: (profile: Profile | null) => void;
  setProfiles: (profiles: Profile[]) => void;
  setAdAccounts: (accounts: AdAccount[]) => void;
  setSelectedAccount: (account: AdAccount | null) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  setMobileSidebarOpen: (v: boolean) => void;
  setDraftName: (name: string | null) => void;
  setTokenExpiresAt: (v: string | null) => void;
}

const storeCreator: StateCreator<AppState, [['zustand/persist', unknown]]> = (set) => ({
  user: null,
  team: null,
  profile: null,
  profiles: [],
  adAccounts: [],
  selectedAccount: null,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  draftName: null,
  tokenExpiresAt: null,
  setUser: (user) => set({ user }),
  setTeam: (team) => set({ team }),
  setProfile: (profile) => {
    set({ profile });
    if (typeof window !== 'undefined') {
      if (profile) {
        localStorage.setItem('profileId', profile.id);
      } else {
        localStorage.removeItem('profileId');
      }
    }
  },
  setProfiles: (profiles) => set({ profiles }),
  setAdAccounts: (accounts) => set({ adAccounts: accounts }),
  setSelectedAccount: (account) => set({ selectedAccount: account }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),
  setDraftName: (draftName) => set({ draftName }),
  setTokenExpiresAt: (tokenExpiresAt) => set({ tokenExpiresAt }),
});

export const useAppStore = create<AppState>()(
  persist(storeCreator, {
    name: 'adspawn-app',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      user: state.user,
      team: state.team,
      profile: state.profile,
      profiles: state.profiles,
      adAccounts: state.adAccounts,
      selectedAccount: state.selectedAccount,
      sidebarCollapsed: state.sidebarCollapsed,
    }),
    skipHydration: true,
  })
);

export function useAppHydration() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    useAppStore.persist.rehydrate();
    setHydrated(true);
  }, []);
  return hydrated;
}
