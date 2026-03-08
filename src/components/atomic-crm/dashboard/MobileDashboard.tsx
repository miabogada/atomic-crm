import { useGetList, useGetIdentity, useGetOne, useTimeout } from "ra-core";
import { Navigate } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";

import type { Account, Sale } from "../types";
import { Welcome } from "./Welcome";
import { Receivables } from "./Receivables";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
    <>
      <MobileHeader>
        <div className="flex items-center gap-2 text-secondary-foreground no-underline py-3">
          <img
            className="[.light_&]:hidden h-6"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-6"
            src={lightModeLogo}
            alt={title}
          />
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </MobileHeader>
      <MobileContent>{children}</MobileContent>
    </>
  );
};

const Loading = () => (
  <Wrapper>
    <Skeleton className="h-4 w-3/4 mb-4" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
  </Wrapper>
);

export const MobileDashboard = () => {
  const { identity } = useGetIdentity();
  const { data: currentUser, isPending: isPendingUser } = useGetOne<Sale>(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const { isPending } = useGetList<Account>("account_contacts", {
    pagination: { page: 1, perPage: 1 },
  });
  const oneSecondHasPassed = useTimeout(1000);

  if (isPending || isPendingUser) {
    return oneSecondHasPassed ? <Loading /> : null;
  }

  if (!currentUser?.administrator) {
    return <Navigate to="/accounts" replace />;
  }

  return (
    <Wrapper>
      <div className="grid grid-cols-1 gap-6 mt-1">
        {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
        <Receivables />
      </div>
    </Wrapper>
  );
};
