import { useAppStore } from "@/store/useAppStore";

// Single place that tears down a session. Used by sign-out buttons, account
// deletion, and the 401/TOKEN_EXPIRED interceptor so no path leaves another
// user's data (drafts-in-progress, selected account, profiles) in the browser.
export function clearSession() {
  try {
    const store = useAppStore.getState();
    store.setUser(null);
    store.setTeam(null);
    store.setProfile(null);
    store.setProfiles([]);
    store.setSelectedAccount(null);
    store.setAdAccounts([]);
  } catch {}

  try {
    localStorage.removeItem("token");
    localStorage.removeItem("profileId");
    localStorage.removeItem("adspawn-app");
    localStorage.removeItem("adspawn-wide-creation");
    // Unsaved draft edits are per-account data — never leave them for the
    // next person on a shared machine.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("adspawn-draft-edits:")) localStorage.removeItem(key);
    }
  } catch {}
}
