import { endOfYesterday, startOfMonth, startOfWeek } from "date-fns";
import { CheckSquare, Clock, FolderOpen, Users } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";

import { FilterCategory } from "../filters/FilterCategory";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useIsMobile } from "@/hooks/use-mobile";

export const AccountListFilter = () => {
  const { accountCategories } = useConfigurationContext();
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();

  return (
    <ResponsiveFilters searchInput={{ placeholder: "Search name, number..." }}>
      <FilterCategory label="Category" icon={<FolderOpen />}>
        {accountCategories.map((category) => (
          <ToggleFilterButton
            key={category}
            className="w-auto md:w-full justify-between h-10 md:h-8"
            label={category}
            value={{ categories: category }}
            size={isMobile ? "lg" : undefined}
          />
        ))}
      </FilterCategory>

      <FilterCategory label="Activity" icon={<Clock />}>
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Updated today"
          value={{
            "updated_at@gte": endOfYesterday().toISOString(),
            "updated_at@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="This week"
          value={{
            "updated_at@gte": startOfWeek(new Date()).toISOString(),
            "updated_at@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Before this week"
          value={{
            "updated_at@gte": undefined,
            "updated_at@lte": startOfWeek(new Date()).toISOString(),
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Before this month"
          value={{
            "updated_at@gte": undefined,
            "updated_at@lte": startOfMonth(new Date()).toISOString(),
          }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      <FilterCategory icon={<CheckSquare />} label="Tasks">
        <ToggleFilterButton
          className="w-full justify-between h-10 md:h-8"
          label="With open tasks"
          value={{ "nb_open_tasks@gt": 0 }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      <FilterCategory icon={<Users />} label="Team">
        <ToggleFilterButton
          className="w-full justify-between h-10 md:h-8"
          label="My accounts (attorney)"
          value={{ attorney_id: identity?.id }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-full justify-between h-10 md:h-8"
          label="My accounts (clerk)"
          value={{ law_clerk_id: identity?.id }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-full justify-between h-10 md:h-8"
          label="My accounts (assistant)"
          value={{ legal_assistant_id: identity?.id }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>
    </ResponsiveFilters>
  );
};
