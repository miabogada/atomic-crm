import * as React from "react";
import { useState } from "react";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { humanize, singularize } from "inflection";
import type { RedirectionSideEffect } from "ra-core";
import {
  useDelete,
  useGetIdentity,
  useGetOne,
  useGetRecordRepresentation,
  useNotify,
  useRecordContext,
  useRedirect,
  useResourceContext,
  useResourceTranslation,
  useTranslate,
} from "ra-core";
import { Confirm } from "./confirm";

export type DeleteButtonProps = {
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  onClick?: React.ReactEventHandler<HTMLButtonElement>;
  mutationOptions?: any;
  redirect?: RedirectionSideEffect;
  resource?: string;
  successMessage?: string;
  confirmContent?: React.ReactNode;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
};

/**
 * Admin-only delete button with confirmation dialog.
 *
 * Hidden for non-admin users. Shows a confirmation dialog before deleting.
 * Uses soft delete (sets deleted_at) for resources that support it.
 */
export const DeleteButton = (props: DeleteButtonProps) => {
  const {
    label: labelProp,
    onClick,
    size,
    mutationOptions,
    redirect: redirectTo = "list",
    successMessage,
    confirmContent,
    variant = "outline",
    className = "cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
  } = props;
  const record = useRecordContext(props);
  const resource = useResourceContext(props);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Admin-only: hide for non-admin users
  const { identity } = useGetIdentity();
  const { data: currentUser } = useGetOne(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );

  const [deleteOne, { isPending }] = useDelete();
  const redirect = useRedirect();
  const notify = useNotify();

  const translate = useTranslate();
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  let recordRepresentation = getRecordRepresentation(record);
  const resourceName = translate(`resources.${resource}.forcedCaseName`, {
    smart_count: 1,
    _: humanize(
      translate(`resources.${resource}.name`, {
        smart_count: 1,
        _: resource ? singularize(resource) : undefined,
      }),
      true,
    ),
  });
  if (React.isValidElement(recordRepresentation)) {
    recordRepresentation = `#${record?.id}`;
  }
  const label = useResourceTranslation({
    resourceI18nKey: `resources.${resource}.action.delete`,
    baseI18nKey: "ra.action.delete",
    options: {
      name: resourceName,
      recordRepresentation,
    },
    userText: labelProp,
  });

  if (!currentUser?.administrator) return null;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.(e);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    deleteOne(
      resource,
      { id: record?.id, previousData: record },
      {
        onSuccess: () => {
          notify(successMessage ?? "ra.notification.deleted", {
            type: "info",
            messageArgs: { smart_count: 1 },
          });
          setConfirmOpen(false);
          redirect(redirectTo, resource);
        },
        onError: (error: any) => {
          notify(
            typeof error === "string"
              ? error
              : error?.message || "ra.notification.http_error",
            { type: "error" },
          );
          setConfirmOpen(false);
        },
        ...mutationOptions,
      },
    );
  };

  return (
    <>
      <Button
        variant={variant}
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={typeof label === "string" ? label : undefined}
        size={size}
        className={className}
      >
        <Trash />
        {label}
      </Button>
      <Confirm
        isOpen={confirmOpen}
        title={`Delete ${resourceName}?`}
        content={confirmContent ?? `Are you sure you want to delete ${recordRepresentation || "this item"}? This action can be reversed by a database administrator.`}
        onConfirm={handleConfirm}
        onClose={() => setConfirmOpen(false)}
        loading={isPending}
        confirm="Delete"
        confirmColor="warning"
      />
    </>
  );
};
