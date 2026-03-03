import { useMutation } from "@tanstack/react-query";
import { CircleX, Copy, Pencil, Save } from "lucide-react";
import {
  Form,
  required,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRecordContext,
} from "ra-core";
import type { ValidateForm } from "ra-core";
import { useState } from "react";
import type { FieldValues, SubmitHandler } from "react-hook-form";
import { useFormState } from "react-hook-form";
import { RecordField } from "@/components/admin/record-field";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import ImageEditorField from "../misc/ImageEditorField";
import { supabase } from "../providers/supabase/supabase";
import type { CrmDataProvider } from "../providers/types";
import type { Sale, SalesFormData } from "../types";

export const SettingsPage = () => {
  const [isEditMode, setEditMode] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const { identity, refetch: refetchIdentity } = useGetIdentity();
  const { data, refetch: refetchUser } = useGetOne("users", {
    id: identity?.id,
  });
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!identity) {
        throw new Error("Record not found");
      }
      return dataProvider.salesUpdate(identity.id, data);
    },
    onSuccess: () => {
      refetchIdentity();
      refetchUser();
      setEditMode(false);
      notify("Your profile has been updated");
    },
    onError: (_) => {
      notify("An error occurred. Please try again", {
        type: "error",
      });
    },
  });

  if (!identity) return null;

  const handleOnSubmit = async (values: any) => {
    mutate(values);
  };

  return (
    <div className="max-w-lg mx-auto mt-8 space-y-4">
      <Form onSubmit={handleOnSubmit} record={data}>
        <SettingsForm
          isEditMode={isEditMode}
          setEditMode={setEditMode}
          showPasswordForm={showPasswordForm}
          setShowPasswordForm={setShowPasswordForm}
        />
      </Form>
      {showPasswordForm && (
        <ChangePasswordForm onClose={() => setShowPasswordForm(false)} />
      )}
    </div>
  );
};

const SettingsForm = ({
  isEditMode,
  setEditMode,
  showPasswordForm,
  setShowPasswordForm,
}: {
  isEditMode: boolean;
  setEditMode: (value: boolean) => void;
  showPasswordForm: boolean;
  setShowPasswordForm: (value: boolean) => void;
}) => {
  const notify = useNotify();
  const record = useRecordContext<Sale>();
  const { identity, refetch } = useGetIdentity();
  const { isDirty } = useFormState();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { mutate: mutateSale } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!record) {
        throw new Error("Record not found");
      }
      return dataProvider.salesUpdate(record.id, data);
    },
    onSuccess: () => {
      refetch();
      notify("Your profile has been updated");
    },
    onError: () => {
      notify("An error occurred. Please try again.");
    },
  });
  if (!identity) return null;

  const handleAvatarUpdate = async (values: any) => {
    mutateSale(values);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="mb-4 flex flex-row justify-between">
            <h2 className="text-xl font-semibold text-muted-foreground">
              My info
            </h2>
          </div>

          <div className="space-y-4 mb-4">
            <ImageEditorField
              source="avatar"
              type="avatar"
              onSave={handleAvatarUpdate}
              linkPosition="right"
            />
            <TextRender source="first_name" isEditMode={isEditMode} />
            <TextRender source="last_name" isEditMode={isEditMode} />
            <TextRender source="email" isEditMode={isEditMode} />
          </div>

          <div className="flex flex-row justify-end gap-2">
            {!isEditMode && (
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
              >
                Change password
              </Button>
            )}

            <Button
              type="button"
              variant={isEditMode ? "ghost" : "outline"}
              onClick={() => setEditMode(!isEditMode)}
              className="flex items-center"
            >
              {isEditMode ? <CircleX /> : <Pencil />}
              {isEditMode ? "Cancel" : "Edit"}
            </Button>

            {isEditMode && (
              <Button type="submit" disabled={!isDirty} variant="outline">
                <Save />
                Save
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {import.meta.env.VITE_INBOUND_EMAIL && (
        <Card>
          <CardContent>
            <div className="space-y-4 justify-between">
              <h2 className="text-xl font-semibold text-muted-foreground">
                Inbound email
              </h2>
              <p className="text-sm text-muted-foreground">
                You can start sending emails to your server's inbound email
                address, e.g. by adding it to the
                <b> Cc: </b> field. Atomic CRM will process the emails and add
                notes to the corresponding contacts.
              </p>
              <CopyPaste />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface PasswordFormData {
  password: string;
  confirmPassword: string;
}

const ChangePasswordForm = ({ onClose }: { onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const notify = useNotify();

  const validate = (values: PasswordFormData) => {
    if (values.password !== values.confirmPassword) {
      return {
        password: "Passwords do not match",
        confirmPassword: "Passwords do not match",
      };
    }
    return {};
  };

  const handleSubmit = async (values: PasswordFormData) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) {
        throw error;
      }
      notify("Your password has been updated");
      onClose();
    } catch (error: any) {
      notify(error?.message ?? "An error occurred. Please try again.", {
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <h2 className="text-xl font-semibold text-muted-foreground mb-4">
          Change password
        </h2>
        <Form<PasswordFormData>
          onSubmit={handleSubmit as SubmitHandler<FieldValues>}
          validate={validate as ValidateForm}
        >
          <div className="space-y-4">
            <TextInput
              label="New password"
              source="password"
              type="password"
              autoComplete="new-password"
              validate={required()}
              helperText={false}
            />
            <TextInput
              label="Confirm password"
              source="confirmPassword"
              type="password"
              autoComplete="new-password"
              validate={required()}
              helperText={false}
            />
            <div className="flex flex-row justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                <CircleX />
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={loading}>
                <Save />
                Save
              </Button>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
};

const TextRender = ({
  source,
  isEditMode,
}: {
  source: string;
  isEditMode: boolean;
}) => {
  if (isEditMode) {
    return <TextInput source={source} helperText={false} />;
  }
  return (
    <div className="m-2">
      <RecordField source={source} />
    </div>
  );
};

const CopyPaste = () => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    setCopied(true);
    navigator.clipboard.writeText(import.meta.env.VITE_INBOUND_EMAIL);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={handleCopy}
            variant="ghost"
            className="normal-case justify-between w-full"
          >
            <span className="overflow-hidden text-ellipsis">
              {import.meta.env.VITE_INBOUND_EMAIL}
            </span>
            <Copy className="h-4 w-4 ml-2" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "Copied!" : "Copy"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

SettingsPage.path = "/settings";
