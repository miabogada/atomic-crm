import { startOfMonth, startOfYear, subMonths } from "date-fns";
import { Briefcase, Clock, DollarSign } from "lucide-react";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";

import { FilterCategory } from "../filters/FilterCategory";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useIsMobile } from "@/hooks/use-mobile";

export const ContractListFilter = () => {
  const { caseTypes } = useConfigurationContext();
  const isMobile = useIsMobile();

  return (
    <ResponsiveFilters
      searchInput={{ placeholder: "Search contract, account..." }}
    >
      <FilterCategory label="Case Type" icon={<Briefcase />}>
        {caseTypes.map((caseType) => (
          <ToggleFilterButton
            key={caseType}
            className="w-auto md:w-full justify-between h-10 md:h-8"
            label={caseType}
            value={{ case_type: caseType }}
            size={isMobile ? "lg" : undefined}
          />
        ))}
      </FilterCategory>

      <FilterCategory label="Date Opened" icon={<Clock />}>
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="This month"
          value={{
            "date_opened@gte": startOfMonth(new Date()).toISOString(),
            "date_opened@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Last 3 months"
          value={{
            "date_opened@gte": subMonths(new Date(), 3).toISOString(),
            "date_opened@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="This year"
          value={{
            "date_opened@gte": startOfYear(new Date()).toISOString(),
            "date_opened@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Older"
          value={{
            "date_opened@gte": undefined,
            "date_opened@lte": startOfYear(new Date()).toISOString(),
          }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      <FilterCategory label="Fee Range" icon={<DollarSign />}>
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Under $2,500"
          value={{
            "fee@gte": undefined,
            "fee@lte": 2500,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="$2,500 - $5,000"
          value={{
            "fee@gte": 2500,
            "fee@lte": 5000,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Over $5,000"
          value={{
            "fee@gte": 5000,
            "fee@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>
    </ResponsiveFilters>
  );
};
