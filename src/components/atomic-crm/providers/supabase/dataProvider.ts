import { supabaseDataProvider } from "ra-supabase-core";
import {
  withLifecycleCallbacks,
  HttpError,
  type DataProvider,
  type GetListParams,
  type GetManyParams,
  type GetManyReferenceParams,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  ContactNote,
  Deal,
  DealNote,
  RAFile,
  Sale,
  SalesFormData,
  SignUpData,
} from "../../types";
import { getActivityLog } from "../commons/activity";
import { getIsInitialized } from "./authProvider";
import { supabase } from "./supabase";

if (import.meta.env.VITE_SUPABASE_URL === undefined) {
  throw new Error("Please set the VITE_SUPABASE_URL environment variable");
}
if (import.meta.env.VITE_SB_PUBLISHABLE_KEY === undefined) {
  throw new Error(
    "Please set the VITE_SB_PUBLISHABLE_KEY environment variable",
  );
}

const baseDataProvider = supabaseDataProvider({
  instanceUrl: import.meta.env.VITE_SUPABASE_URL,
  apiKey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
  supabaseClient: supabase,
  sortOrder: "asc,desc.nullslast" as any,
});

const processCompanyLogo = async (params: any) => {
  const logo = params.data.logo;

  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
  }

  return {
    ...params,
    data: {
      ...params.data,
      logo,
    },
  };
};

// Resources that support soft delete (have a deleted_at column)
const SOFT_DELETE_RESOURCES = new Set([
  "accounts",
  "accounts_summary",
  "account_contacts",
  "account_contracts",
  "account_payments",
  "account_activities",
  "tasks",
]);

// Resources read through a view that adds computed columns. Writes still go
// to the underlying table.
const READ_VIEWS: Record<string, string> = {
  account_contracts: "account_contracts_summary",
};
const readResource = (resource: string) => READ_VIEWS[resource] ?? resource;

// Computed (view-only) contract fields that must never be written to the table
const CONTRACT_VIEW_FIELDS = [
  "case_type_ids",
  "case_type_names",
  "case_types_label",
] as const;

/**
 * Replace a contract's case types in the account_contract_case_types join table.
 * Inserts new links before deleting removed ones, so a failure part-way never
 * leaves the contract with fewer case types than it started with.
 */
const syncContractCaseTypes = async (
  contractId: Identifier,
  caseTypeIds: Identifier[],
) => {
  const ids = [...new Set(caseTypeIds.map(Number))];
  if (ids.length > 0) {
    const { error } = await supabase
      .from("account_contract_case_types")
      .upsert(
        ids.map((case_type_id) => ({ contract_id: contractId, case_type_id })),
        { onConflict: "contract_id,case_type_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(`Failed to save case types: ${error.message}`);
  }
  let del = supabase
    .from("account_contract_case_types")
    .delete()
    .eq("contract_id", contractId);
  if (ids.length > 0) del = del.not("case_type_id", "in", `(${ids.join(",")})`);
  const { error } = await del;
  if (error) throw new Error(`Failed to save case types: ${error.message}`);
};

/** Split contract form data into table columns and the case type ids (if present). */
const splitContractData = (data: Record<string, any>) => {
  const tableData = { ...data };
  const caseTypeIds = tableData.case_type_ids as Identifier[] | undefined;
  for (const field of CONTRACT_VIEW_FIELDS) delete tableData[field];
  return { tableData, caseTypeIds };
};

/** baseDataProvider with view routing for reads, for internal helpers like the activity log. */
const baseReadProvider: DataProvider = {
  ...baseDataProvider,
  getList: (resource, params) =>
    baseDataProvider.getList(readResource(resource), params),
};

const dataProviderWithCustomMethods = {
  ...baseDataProvider,
  async create(resource: string, params: any) {
    if (resource === "account_contracts") {
      const { tableData, caseTypeIds } = splitContractData(params.data);
      const result = await baseDataProvider.create(resource, {
        ...params,
        data: tableData,
      });
      if (caseTypeIds) await syncContractCaseTypes(result.data.id, caseTypeIds);
      return baseDataProvider.getOne(readResource(resource), {
        id: result.data.id,
      });
    }
    return baseDataProvider.create(resource, params);
  },
  async update(resource: string, params: any) {
    if (resource === "account_contracts") {
      const { tableData, caseTypeIds } = splitContractData(params.data);
      const { tableData: previousData } = splitContractData(
        params.previousData ?? {},
      );
      await baseDataProvider.update(resource, {
        ...params,
        data: tableData,
        previousData,
      });
      if (caseTypeIds) await syncContractCaseTypes(params.id, caseTypeIds);
      return baseDataProvider.getOne(readResource(resource), { id: params.id });
    }
    return baseDataProvider.update(resource, params);
  },
  async delete(resource: string, params: any) {
    // Soft delete: set deleted_at instead of hard delete
    if (SOFT_DELETE_RESOURCES.has(resource)) {
      return baseDataProvider.update(resource, {
        id: params.id,
        data: { deleted_at: new Date().toISOString() },
        previousData: params.previousData,
      });
    }
    return baseDataProvider.delete(resource, params);
  },
  async deleteMany(resource: string, params: any) {
    // Soft delete: set deleted_at on each record
    if (SOFT_DELETE_RESOURCES.has(resource)) {
      const results = await Promise.all(
        params.ids.map((id: Identifier) =>
          baseDataProvider.update(resource, {
            id,
            data: { deleted_at: new Date().toISOString() },
            previousData: { id },
          }),
        ),
      );
      return { data: results.map((r: any) => r.data.id) };
    }
    return baseDataProvider.deleteMany(resource, params);
  },
  async getList(resource: string, params: GetListParams) {
    if (resource === "companies") {
      return baseDataProvider.getList("companies_summary", params);
    }
    if (resource === "contacts") {
      return baseDataProvider.getList("contacts_summary", params);
    }
    if (resource === "accounts") {
      return baseDataProvider.getList("accounts_summary", params);
    }
    if (resource === "contract_payment_schedule") {
      return baseDataProvider.getList("contract_payment_schedule_view", params);
    }

    // For soft-delete resources queried directly (not via views),
    // inject deleted_at IS NULL filter
    if (SOFT_DELETE_RESOURCES.has(resource)) {
      return baseDataProvider.getList(readResource(resource), {
        ...params,
        filter: { ...params.filter, "deleted_at@is": null },
      });
    }

    return baseDataProvider.getList(readResource(resource), params);
  },
  async getManyReference(resource: string, params: GetManyReferenceParams) {
    // For soft-delete resources, inject deleted_at IS NULL filter so
    // ReferenceManyField/ReferenceManyCount don't show/count deleted rows
    if (SOFT_DELETE_RESOURCES.has(resource)) {
      return baseDataProvider.getManyReference(readResource(resource), {
        ...params,
        filter: { ...params.filter, "deleted_at@is": null },
      });
    }

    return baseDataProvider.getManyReference(readResource(resource), params);
  },
  async getOne(resource: string, params: any) {
    if (resource === "companies") {
      return baseDataProvider.getOne("companies_summary", params);
    }
    if (resource === "contacts") {
      return baseDataProvider.getOne("contacts_summary", params);
    }
    if (resource === "accounts") {
      return baseDataProvider.getOne("accounts_summary", params);
    }
    if (resource === "contract_payment_schedule") {
      return baseDataProvider.getOne("contract_payment_schedule_view", params);
    }

    const result = await baseDataProvider.getOne(readResource(resource), params);
    if (SOFT_DELETE_RESOURCES.has(resource) && (result.data as any)?.deleted_at) {
      throw new HttpError("Not found", 404);
    }
    return result;
  },
  async getMany(resource: string, params: GetManyParams) {
    const result = await baseDataProvider.getMany(readResource(resource), params);
    if (SOFT_DELETE_RESOURCES.has(resource)) {
      return {
        ...result,
        data: result.data.filter((record: any) => !record.deleted_at),
      };
    }
    return result;
  },

  async signUp({ email, password, first_name, last_name }: SignUpData) {
    const response = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name,
          last_name,
        },
      },
    });

    if (!response.data?.user || response.error) {
      console.error("signUp.error", response.error);
      throw new Error(response?.error?.message || "Failed to create account");
    }

    // Update the is initialized cache
    getIsInitialized._is_initialized_cache = true;

    return {
      id: response.data.user.id,
      email,
      password,
    };
  },
  async salesCreate(body: SalesFormData) {
    const { data, error } = await supabase.functions.invoke<{ data: Sale }>(
      "users",
      {
        method: "POST",
        body,
      },
    );

    if (!data || error) {
      console.error("salesCreate.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(errorDetails?.message || "Failed to create the user");
    }

    return data.data;
  },
  async salesUpdate(
    id: Identifier,
    data: Partial<Omit<SalesFormData, "password">>,
  ) {
    const { email, first_name, last_name, administrator, avatar, disabled } =
      data;

    const { data: updatedData, error } = await supabase.functions.invoke<{
      data: Sale;
    }>("users", {
      method: "PATCH",
      body: {
        user_id: id,
        email,
        first_name,
        last_name,
        administrator,
        disabled,
        avatar,
      },
    });

    if (!updatedData || error) {
      console.error("salesCreate.error", error);
      throw new Error("Failed to update account manager");
    }

    return updatedData.data;
  },
  async updatePassword(id: Identifier) {
    const { data: passwordUpdated, error } =
      await supabase.functions.invoke<boolean>("update_password", {
        method: "PATCH",
        body: {
          user_id: id,
        },
      });

    if (!passwordUpdated || error) {
      console.error("update_password.error", error);
      throw new Error("Failed to update password");
    }

    return passwordUpdated;
  },
  async unarchiveDeal(deal: Deal) {
    // get all deals where stage is the same as the deal to unarchive
    const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
      filter: { stage: deal.stage },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "index", order: "ASC" },
    });

    // set index for each deal starting from 1, if the deal to unarchive is found, set its index to the last one
    const updatedDeals = deals.map((d, index) => ({
      ...d,
      index: d.id === deal.id ? 0 : index + 1,
      archived_at: d.id === deal.id ? null : d.archived_at,
    }));

    return await Promise.all(
      updatedDeals.map((updatedDeal) =>
        baseDataProvider.update("deals", {
          id: updatedDeal.id,
          data: updatedDeal,
          previousData: deals.find((d) => d.id === updatedDeal.id),
        }),
      ),
    );
  },
  async getActivityLog(companyId?: Identifier) {
    return getActivityLog(baseReadProvider, companyId);
  },
  async getAccountActivityLog(accountId: Identifier) {
    return getActivityLog(baseReadProvider, undefined, undefined, accountId);
  },
  async isInitialized() {
    return getIsInitialized();
  },
  async mergeContacts(sourceId: Identifier, targetId: Identifier) {
    const { data, error } = await supabase.functions.invoke("merge_contacts", {
      method: "POST",
      body: { loserId: sourceId, winnerId: targetId },
    });

    if (error) {
      console.error("merge_contacts.error", error);
      throw new Error("Failed to merge contacts");
    }

    return data;
  },
} satisfies DataProvider;

export type CrmDataProvider = typeof dataProviderWithCustomMethods;

const lifeCycleCallbacks: ResourceCallbacks[] = [
  {
    resource: "contact_notes",
    beforeSave: async (data: ContactNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_notes",
    beforeSave: async (data: DealNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "users",
    beforeSave: async (data: Sale, _, __) => {
      if (data.avatar) {
        await uploadToBucket(data.avatar);
      }
      return data;
    },
  },
  {
    resource: "contacts",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "first_name",
        "last_name",
        "company_name",
        "title",
        "email",
        "phone",
        "background",
      ])(params);
    },
  },
  {
    resource: "companies",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "name",
        "phone_number",
        "website",
        "zipcode",
        "city",
        "state_abbr",
      ])(params);
    },
    beforeCreate: async (params) => {
      const createParams = await processCompanyLogo(params);

      return {
        ...createParams,
        data: {
          created_at: new Date().toISOString(),
          ...createParams.data,
        },
      };
    },
    beforeUpdate: async (params) => {
      return await processCompanyLogo(params);
    },
  },
  {
    resource: "contacts_summary",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["first_name", "last_name"])(params);
    },
  },
  {
    resource: "deals",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["name", "category", "description"])(params);
    },
  },
  {
    resource: "accounts",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["name", "account_number"])(params);
    },
  },
  {
    resource: "account_contacts",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["first_name", "last_name"])(params);
    },
  },
  {
    resource: "account_contracts",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["contract_number", "case_types_label"])(
        params,
      );
    },
  },
  {
    resource: "tasks",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["text", "type"])(params);
    },
  },
];

export const dataProvider = withLifecycleCallbacks(
  dataProviderWithCustomMethods,
  lifeCycleCallbacks,
);

const applyFullTextSearch = (columns: string[]) => (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  return {
    ...params,
    filter: {
      ...filter,
      "@or": columns.reduce((acc, column) => {
        if (column === "email")
          return {
            ...acc,
            [`email_fts@ilike`]: q,
          };
        if (column === "phone")
          return {
            ...acc,
            [`phone_fts@ilike`]: q,
          };
        else
          return {
            ...acc,
            [`${column}@ilike`]: q,
          };
      }, {}),
    },
  };
};

const uploadToBucket = async (fi: RAFile) => {
  if (!fi.src.startsWith("blob:") && !fi.src.startsWith("data:")) {
    // Sign URL check if path exists in the bucket
    if (fi.path) {
      const { error } = await supabase.storage
        .from("attachments")
        .createSignedUrl(fi.path, 60);

      if (!error) {
        return fi;
      }
    }
  }

  const dataContent = fi.src
    ? await fetch(fi.src)
        .then((res) => {
          if (res.status !== 200) {
            return null;
          }
          return res.blob();
        })
        .catch(() => null)
    : fi.rawFile;

  if (dataContent == null) {
    // We weren't able to download the file from its src (e.g. user must be signed in on another website to access it)
    // or the file has no content (not probable)
    // In that case, just return it as is: when trying to download it, users should be redirected to the other website
    // and see they need to be signed in. It will then be their responsibility to upload the file back to the note.
    return fi;
  }

  const file = fi.rawFile;
  const fileParts = file.name.split(".");
  const fileExt = fileParts.length > 1 ? `.${file.name.split(".").pop()}` : "";
  const fileName = `${Math.random()}${fileExt}`;
  const filePath = `${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(filePath, dataContent);

  if (uploadError) {
    console.error("uploadError", uploadError);
    throw new Error("Failed to upload attachment");
  }

  const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);

  fi.path = filePath;
  fi.src = data.publicUrl;

  // save MIME type
  const mimeType = file.type;
  fi.type = mimeType;

  return fi;
};
