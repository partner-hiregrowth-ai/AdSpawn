"use client";

import { useAppStore, Profile } from "@/store/useAppStore";
import { usePathname, useRouter } from "next/navigation";
import { User, LogOut, ChevronRight, Menu, Users, ChevronDown, CreditCard, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const pageTitles: Record<string, string> = {
  "/dashboard": "Account",
  "/explorer": "Explorer",
  "/drafts": "Drafts",
  "/wide-create": "Wide Create",
  "/history": "History",
  "/settings": "Settings",
};

export const Navbar = () => {
  const { user, team, profile, profiles, setProfile, adAccounts, selectedAccount, setSelectedAccount, draftName, toggleMobileSidebar } = useAppStore();
  const pathname = usePathname();
  const router = useRouter();
  const currentPage = pageTitles[pathname] || (pathname.startsWith("/drafts/") ? (draftName ?? "Draft Editor") : "");

  const handleSwitchProfile = (p: Profile) => {
    setProfile(p);
    router.refresh();
  };

  return (
    <nav className="h-14 border-b border-gray-800/50 bg-gray-950/90 backdrop-blur-xl flex items-center justify-between px-4 sm:px-5 sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden p-2.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors -ml-1.5 shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-lg font-bold text-blue-400 shrink-0">
          AdSpawn
        </h1>
        {currentPage && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-700 shrink-0" />
            <span className="text-sm text-gray-400 font-medium hidden sm:inline">{currentPage}</span>
          </>
        )}
        {selectedAccount && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-700 shrink-0 hidden sm:inline" />
            <div className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium max-w-[140px] truncate hidden sm:block">
              {selectedAccount.name}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={() => window.dispatchEvent(new Event("adspawn:open-palette"))}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-800/30 border border-gray-700/30 hover:bg-gray-800/60 hover:border-gray-700/60 transition-colors text-gray-600 hover:text-gray-400"
          title="Open command palette (⌘K) · Keyboard shortcuts (?)"
          aria-label="Open command palette"
        >
          <Search className="w-3 h-3" />
          <span className="text-[10px] font-mono text-gray-700">⌘K</span>
        </button>
        {profile && profiles.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/40 hover:bg-gray-800/60 transition-colors outline-none">
                  <User className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-300 max-w-[100px] truncate">{profile.name}</span>
                  <ChevronDown className="w-3 h-3 text-gray-600" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-48 bg-gray-900 border-gray-800">
              <div className="px-3 py-1.5">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Profile</p>
              </div>
              {profiles.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => handleSwitchProfile(p)}
                  className={`text-xs cursor-pointer ${p.id === profile.id ? "text-blue-400 bg-blue-500/5" : "text-gray-300"}`}
                >
                  <User className="w-3 h-3 mr-2" />
                  {p.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem
                onClick={() => router.push("/profiles")}
                className="text-xs text-gray-500 cursor-pointer"
              >
                <Users className="w-3 h-3 mr-2" />
                Manage profiles
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {adAccounts.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/40 hover:bg-gray-800/60 transition-colors outline-none">
                  <CreditCard className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-300 max-w-[100px] truncate hidden sm:inline">
                    {selectedAccount?.name || "Ad Account"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-600" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-800 max-h-72 overflow-y-auto">
              <div className="px-3 py-1.5">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Ad Account</p>
              </div>
              {adAccounts.map((acc) => (
                <DropdownMenuItem
                  key={acc.id}
                  onClick={() => {
                    setSelectedAccount(acc);
                    router.push("/explorer");
                  }}
                  className={`text-xs cursor-pointer ${acc.id === selectedAccount?.id ? "text-cyan-400 bg-cyan-500/5" : "text-gray-300"}`}
                >
                  <CreditCard className="w-3 h-3 mr-2" />
                  <span className="truncate">{acc.name}</span>
                  {acc.currency && <span className="ml-auto text-[10px] text-gray-600 font-mono shrink-0">{acc.currency}</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem
                onClick={() => router.push("/dashboard")}
                className="text-xs text-gray-500 cursor-pointer"
              >
                <CreditCard className="w-3 h-3 mr-2" />
                All accounts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button className="flex items-center gap-2 sm:gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-800/50 transition-colors outline-none shrink-0" />}
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-300 leading-none">{user?.name || "Member"}</p>
              {user?.email && <p className="text-[11px] text-gray-600 mt-0.5">{user.email}</p>}
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center ring-2 ring-gray-800 shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-800">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-gray-200">{user?.name || "Member"}</p>
              {user?.email && <p className="text-xs text-gray-500">{user.email}</p>}
              {team && <p className="text-[11px] text-gray-600 mt-1 flex items-center gap-1"><Users className="w-3 h-3" /> {team.name}</p>}
            </div>
            <DropdownMenuSeparator className="bg-gray-800" />
            <DropdownMenuItem
              onClick={() => {
                const store = useAppStore.getState();
                store.setUser(null);
                store.setTeam(null);
                store.setProfile(null);
                store.setProfiles([]);
                store.setSelectedAccount(null);
                store.setAdAccounts([]);
                localStorage.removeItem("token");
                localStorage.removeItem("profileId");
                localStorage.removeItem("adspawn-app");
                localStorage.removeItem("adspawn-wide-creation");
                window.location.href = "/login";
              }}
              className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};
