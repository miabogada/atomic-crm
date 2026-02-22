import { Tag, Users } from "lucide-react";
import { useGetList } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";

import { FilterCategory } from "../filters/FilterCategory";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useIsMobile } from "@/hooks/use-mobile";

export const AccountContactListFilter = () => {
  const isMobile = useIsMobile();
  const { data: contactTypes } = useGetList("contact_types", {
    pagination: { page: 1, perPage: 50 },
    sort: { field: "name", order: "ASC" },
  });

  return (
    <ResponsiveFilters searchInput={{ placeholder: "Search contacts..." }}>
      {contactTypes && contactTypes.length > 0 && (
        <FilterCategory label="Contact Type" icon={<Tag />}>
          {contactTypes.map((type) => (
            <ToggleFilterButton
              key={type.id}
              className="w-auto md:w-full justify-between h-10 md:h-8"
              label={type.name}
              value={{ contact_type_id: type.id }}
              size={isMobile ? "lg" : undefined}
            />
          ))}
        </FilterCategory>
      )}

      <FilterCategory icon={<Users />} label="Role">
        <ToggleFilterButton
          className="w-full justify-between h-10 md:h-8"
          label="Billing contact"
          value={{ is_billing_contact: true }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>
    </ResponsiveFilters>
  );
};
