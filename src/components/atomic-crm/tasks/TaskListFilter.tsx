import {
  endOfToday,
  endOfTomorrow,
  endOfWeek,
  startOfToday,
} from "date-fns";
import { CircleDot, Clock, Tag, Users } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";

import { FilterCategory } from "../filters/FilterCategory";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useIsMobile } from "@/hooks/use-mobile";

// Each Due Date filter must declare ALL due-date keys so that switching
// between filters clears stale keys via ToggleFilterButton's toggleFilter.
// Keys set to `undefined` are stripped by pickBy before the API call but
// still participate in the "remove old keys" logic of toggleFilter.
const dueDateFilters = {
  overdue: {
    "due_date@lt": startOfToday().toISOString(),
    "due_date@gt": undefined,
    "due_date@gte": undefined,
    "due_date@lte": undefined,
  },
  today: {
    "due_date@gte": startOfToday().toISOString(),
    "due_date@lte": endOfToday().toISOString(),
    "due_date@lt": undefined,
    "due_date@gt": undefined,
  },
  tomorrow: {
    "due_date@gt": endOfToday().toISOString(),
    "due_date@lt": endOfTomorrow().toISOString(),
    "due_date@gte": undefined,
    "due_date@lte": undefined,
  },
  thisWeek: {
    "due_date@gte": endOfTomorrow().toISOString(),
    "due_date@lte": endOfWeek(new Date(), { weekStartsOn: 0 }).toISOString(),
    "due_date@lt": undefined,
    "due_date@gt": undefined,
  },
  later: {
    "due_date@gt": endOfWeek(new Date(), { weekStartsOn: 0 }).toISOString(),
    "due_date@lt": undefined,
    "due_date@gte": undefined,
    "due_date@lte": undefined,
  },
};

export const TaskListFilter = () => {
  const { taskStatuses, taskTypes } = useConfigurationContext();
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();

  return (
    <ResponsiveFilters searchInput={{ placeholder: "Search tasks..." }}>
      <FilterCategory label="Due Date" icon={<Clock />}>
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Overdue"
          value={dueDateFilters.overdue}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Today"
          value={dueDateFilters.today}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Tomorrow"
          value={dueDateFilters.tomorrow}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="This week"
          value={dueDateFilters.thisWeek}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Later"
          value={dueDateFilters.later}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      <FilterCategory label="Status" icon={<CircleDot />}>
        {taskStatuses.map((status) => (
          <ToggleFilterButton
            key={status}
            className="w-auto md:w-full justify-between h-10 md:h-8"
            label={status}
            value={{ status }}
            size={isMobile ? "lg" : undefined}
          />
        ))}
      </FilterCategory>

      <FilterCategory label="Type" icon={<Tag />}>
        {taskTypes.map((type) => (
          <ToggleFilterButton
            key={type}
            className="w-auto md:w-full justify-between h-10 md:h-8"
            label={type}
            value={{ type }}
            size={isMobile ? "lg" : undefined}
          />
        ))}
      </FilterCategory>

      <FilterCategory icon={<Users />} label="Assigned to">
        <ToggleFilterButton
          className="w-full justify-between h-10 md:h-8"
          label="Me"
          value={{ user_id: identity?.id }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>
    </ResponsiveFilters>
  );
};
