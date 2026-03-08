/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import type { RaRecord, UseBulkDeleteControllerParams } from "ra-core";
import {
  Translate,
  useBulkDeleteController,
  useGetIdentity,
  useGetOne,
} from "ra-core";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * A button that deletes multiple selected records at once.
 *
 * Allows to delete selected records in a DataTable. Use within
 * the bulkActionsButtons prop of DataTable or inside BulkActionsToolbar.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/bulkdeletebutton/ BulkDeleteButton documentation}
 *
 * @example
 * import { BulkDeleteButton, BulkExportButton, DataTable, List } from '@/components/admin';
 *
 * export const PostList = () => (
 *   <List>
 *     <DataTable
 *       bulkActionsButtons={
 *         <>
 *           <BulkExportButton />
 *           <BulkDeleteButton />
 *         </>
 *       }
 *     >
 *       ...
 *     </DataTable>
 *   </List>
 * );
 */
export const BulkDeleteButton = <
  RecordType extends RaRecord = any,
  MutationOptionsError = unknown,
>({
  icon = defaultIcon,
  label,
  className,
  ...props
}: BulkDeleteButtonProps<RecordType, MutationOptionsError>) => {
  const { identity } = useGetIdentity();
  const { data: currentUser } = useGetOne(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const { handleDelete, isPending } = useBulkDeleteController(props);

  if (!currentUser?.administrator) return null;

  return (
    <Button
      variant="destructive"
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className={cn("h-9", className)}
    >
      {icon}
      <Translate i18nKey={label ?? "ra.action.delete"}>
        {label ?? "Delete"}
      </Translate>
    </Button>
  );
};

export type BulkDeleteButtonProps<
  RecordType extends RaRecord = any,
  MutationOptionsError = unknown,
> = {
  label?: string;
  icon?: ReactNode;
} & React.ComponentPropsWithoutRef<"button"> &
  UseBulkDeleteControllerParams<RecordType, MutationOptionsError>;

const defaultIcon = <Trash />;
