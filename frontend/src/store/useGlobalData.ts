import useSWR from "swr";
import { useEffect } from "react";
import { useAppStore, Profile } from "./useAppStore";
import { Team, AdAccount } from "@/types";

export function useGlobalData() {
  const { setTeam, setProfiles, setProfile, setAdAccounts, profile } = useAppStore();

  const { data: teamData } = useSWR<Team>("/team");
  const { data: profilesData } = useSWR<Profile[]>("/profiles");
  const { data: adAccountsData } = useSWR<AdAccount[]>("/adaccounts");

  useEffect(() => {
    if (teamData) setTeam(teamData);
  }, [teamData, setTeam]);

  useEffect(() => {
    if (profilesData) {
      setProfiles(profilesData);
      const savedId = localStorage.getItem("profileId");
      if (savedId && !profile) {
        const found = profilesData.find((p) => p.id === savedId);
        if (found) setProfile(found);
      }
    }
  }, [profilesData, setProfiles, setProfile, profile]);

  useEffect(() => {
    if (adAccountsData) setAdAccounts(adAccountsData);
  }, [adAccountsData, setAdAccounts]);
}
