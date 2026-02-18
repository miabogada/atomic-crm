import { useGetIdentity, useListFilterContext } from "ra-core";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const OnlyMineInput = (_: { alwaysOn: boolean; source: string }) => {
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const { identity } = useGetIdentity();

  const handleChange = () => {
    const newFilterValues = { ...filterValues };
    if (typeof filterValues.user_id !== "undefined") {
      delete newFilterValues.user_id;
    } else {
      newFilterValues.user_id = identity && identity?.id;
    }
    setFilters(newFilterValues, displayedFilters);
  };
  return (
    <div className="mt-auto pb-2.25">
      <div className="flex items-center space-x-2">
        <Switch
          id="only-mine"
          checked={typeof filterValues.user_id !== "undefined"}
          onCheckedChange={handleChange}
        />
        <Label htmlFor="only-mine">Only companies I manage</Label>
      </div>
    </div>
  );
};
