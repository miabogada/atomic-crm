import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { Navigate } from "react-router-dom";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";
import { initialHash } from "../providers/supabase/supabase";
import { LoginSkeleton } from "./LoginSkeleton";
import { LoginPage } from "./LoginPage";

export const StartPage = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { disableEmailPasswordAuthentication } = useConfigurationContext();
  const {
    data: isInitialized,
    error,
    isPending,
  } = useQuery({
    queryKey: ["init"],
    queryFn: async () => {
      return dataProvider.isInitialized();
    },
  });

  // Detect password recovery redirect from Supabase email link.
  // GoTrue appends tokens as hash params (e.g. #access_token=xxx&type=recovery)
  // which conflicts with hash routing. Extract and forward as query params so
  // SetPasswordPage can read them via useSupabaseAccessToken / useSearchParams.
  if (initialHash.includes("type=recovery") && initialHash.includes("access_token=")) {
    const hash = initialHash;
    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get("access_token") ?? "";
    const refresh_token = params.get("refresh_token") ?? "";
    return (
      <Navigate
        to={`/set-password?access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`}
      />
    );
  }

  if (isPending) return <LoginSkeleton />;
  if (error) return <LoginPage />;
  if (isInitialized) return <LoginPage />;
  if (disableEmailPasswordAuthentication) return <LoginPage />;

  return <Navigate to="/sign-up" />;
};
