import useSWR from "swr";
import { useEffect } from "react";
import { useAppStore } from "./useAppStore";

export function useGlobalData() {
  const { setTeam, setProfiles, setProfile, setAdAccounts, profile } = useAppStore();

  const { data: teamData } = useSWR("/team");
  const { data: profilesData } = useSWR("/profiles");
  const { data: adAccountsData } = useSWR("/adaccounts");

  useEffect(() => {
    if (teamData) setTeam(teamData);
  }, [teamData, setTeam]);

  useEffect(() => {
    if (profilesData) {
      setProfiles(profilesData);
      const savedId = localStorage.getItem("profileId");
      if (savedId && !profile) {
        const found = profilesData.find((p: any) => p.id === savedId);
        if (found) setProfile(found);
      }
    }
  }, [profilesData, setProfiles, setProfile, profile]);

  useEffect(() => {
    if (adAccountsData) setAdAccounts(adAccountsData);
  }, [adAccountsData, setAdAccounts]);
}
