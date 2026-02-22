import { useGetList } from "ra-core";

import { DashboardActivityLog } from "./DashboardActivityLog";
import { DealsChart } from "./DealsChart";
import { CompletedTasksList } from "./CompletedTasksList";
import { TasksList } from "./TasksList";
import { Welcome } from "./Welcome";
import { Receivables } from "./Receivables";

export const Dashboard = () => {
  const { total: totalDeal, isPending: isPendingDeal } = useGetList(
    "deals",
    {
      pagination: { page: 1, perPage: 1 },
    },
  );

  if (isPendingDeal) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-1">
      <div className="md:col-span-3">
        <div className="flex flex-col gap-4">
          {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
          {/* Receivables: overdue AR + upcoming 30-day cashflow */}
          <Receivables />
          {/* Performance and Deadlines panels: future */}
        </div>
      </div>
      <div className="md:col-span-6">
        <div className="flex flex-col gap-6">
          {totalDeal ? <DealsChart /> : null}
          <DashboardActivityLog />
        </div>
      </div>

      <div className="md:col-span-3">
        <div className="flex flex-col gap-6">
          <TasksList />
          <CompletedTasksList />
        </div>
      </div>
    </div>
  );
};
