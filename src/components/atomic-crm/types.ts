import type { Identifier, RaRecord } from "ra-core";
import type { ComponentType } from "react";

import type {
  ACCOUNT_ACTIVITY_CREATED,
  COMPANY_CREATED,
  CONTRACT_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
  PAYMENT_RECEIVED,
  TASK_COMPLETED,
} from "./consts";

export type SignUpData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type SalesFormData = {
  avatar?: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  disabled: boolean;
};

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;
  role?: "attorney" | "law_clerk" | "legal_assistant" | null;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  /**
   * This is used by the fake rest provider to store the password
   * DO NOT USE this field in your code besides the fake rest provider
   * @deprecated
   */
  password?: string;
} & Pick<RaRecord, "id">;

export type Company = {
  name: string;
  logo: RAFile;
  sector: string;
  size: 1 | 10 | 50 | 250 | 500;
  linkedin_url: string;
  website: string;
  phone_number: string;
  address: string;
  zipcode: string;
  city: string;
  state_abbr: string;
  user_id?: Identifier | null;
  created_at: string;
  description: string;
  revenue: string;
  tax_identifier: string;
  country: string;
  context_links?: string[];
  nb_contacts?: number;
  nb_deals?: number;
} & Pick<RaRecord, "id">;

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type Contact = {
  first_name: string;
  last_name: string;
  title: string;
  company_id?: Identifier | null;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  linkedin_url?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  tags: Identifier[];
  gender: string;
  user_id?: Identifier | null;
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  nb_tasks?: number;
  company_name?: string;
} & Pick<RaRecord, "id">;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  user_id: Identifier;
  status: string;
  attachments?: AttachmentNote[];
} & Pick<RaRecord, "id">;

export type Deal = {
  name: string;
  company_id: Identifier;
  contact_ids: Identifier[];
  category: string;
  stage: string;
  description: string;
  amount: number;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  expected_closing_date: string;
  user_id: Identifier;
  index: number;
} & Pick<RaRecord, "id">;

export type DealNote = {
  deal_id: Identifier;
  text: string;
  date: string;
  user_id: Identifier;
  attachments?: AttachmentNote[];

  // This is defined for compatibility with `ContactNote`
  status?: undefined;
} & Pick<RaRecord, "id">;

export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type Task = {
  contact_id?: Identifier | null;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  status?: string;
  user_id?: Identifier;
  account_id?: Identifier | null;
  parent_type?: string | null;
  parent_id?: Identifier | null;
} & Pick<RaRecord, "id">;

export type ActivityCompanyCreated = {
  type: typeof COMPANY_CREATED;
  company_id: Identifier;
  company: Company;
  user_id: Identifier;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactCreated = {
  type: typeof CONTACT_CREATED;
  company_id: Identifier;
  user_id?: Identifier;
  contact: Contact;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactNoteCreated = {
  type: typeof CONTACT_NOTE_CREATED;
  user_id?: Identifier;
  contactNote: ContactNote;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityDealCreated = {
  type: typeof DEAL_CREATED;
  company_id: Identifier;
  user_id?: Identifier;
  deal: Deal;
  date: string;
};

export type ActivityDealNoteCreated = {
  type: typeof DEAL_NOTE_CREATED;
  user_id?: Identifier;
  dealNote: DealNote;
  date: string;
};

export type ActivityAccountActivityCreated = {
  type: typeof ACCOUNT_ACTIVITY_CREATED;
  account_id: Identifier;
  user_id?: Identifier;
  accountActivity: AccountActivity;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityTaskCompleted = {
  type: typeof TASK_COMPLETED;
  account_id?: Identifier | null;
  user_id?: Identifier;
  task: Task;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityPaymentReceived = {
  type: typeof PAYMENT_RECEIVED;
  account_id: Identifier;
  user_id?: Identifier | null;
  payment: AccountPayment;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContractCreated = {
  type: typeof CONTRACT_CREATED;
  account_id: Identifier;
  user_id?: Identifier | null;
  contract: AccountContract;
  date: string;
} & Pick<RaRecord, "id">;

export type Activity = RaRecord &
  (
    | ActivityCompanyCreated
    | ActivityContactCreated
    | ActivityContactNoteCreated
    | ActivityDealCreated
    | ActivityDealNoteCreated
    | ActivityAccountActivityCreated
    | ActivityTaskCompleted
    | ActivityPaymentReceived
    | ActivityContractCreated
  );

export interface RAFile {
  src: string;
  title: string;
  path?: string;
  rawFile: File;
  type?: string;
}

export type AttachmentNote = RAFile;
export interface DealStage {
  value: string;
  label: string;
}

export interface NoteStatus {
  value: string;
  label: string;
  color: string;
}

export interface ContactGender {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

// Clarklaw immigration law office types

export type Account = {
  account_number: string;
  name: string;
  phone?: string;
  email?: string;
  attorney_id?: Identifier | null;
  law_clerk_id?: Identifier | null;
  legal_assistant_id?: Identifier | null;
  date_opened?: string;
  date_closed?: string;
  date_first_consult?: string;
  categories?: string;
  referred_by?: string;
  notes?: string;
  archived: boolean;
  archive_year?: number;
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
  user_id?: Identifier | null;
  // From accounts_summary view
  billing_street?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country?: string;
  billing_contact_name?: string;
  nb_contacts?: number;
  nb_contracts?: number;
  nb_open_tasks?: number;
  // From accounts_summary payment aggregates
  total_received?: number;
  total_contracted?: number;
  balance_due?: number;
} & Pick<RaRecord, "id">;

export type ContactType = {
  name: string;
} & Pick<RaRecord, "id">;

export type AccountContact = {
  account_id: Identifier;
  contact_type_id?: Identifier | null;
  is_billing_contact: boolean;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country?: string;
  created_at: string;
  user_id?: Identifier | null;
} & Pick<RaRecord, "id">;

export type AccountContract = {
  account_id: Identifier;
  contract_number?: string;
  case_type?: string;
  status?: string;
  fee?: number;
  retainer?: number;
  monthly_payment?: number;
  num_payments?: number;
  final_payment?: number;
  date_opened?: string;
  date_retainer?: string;
  date_first_payment?: string;
  work_description?: string;
  created_at: string;
  user_id?: Identifier | null;
} & Pick<RaRecord, "id">;


export type ContractPaymentSchedule = {
  contract_id: Identifier;
  account_id: Identifier;
  payment_number: number;   // 0 = retainer, 1..N = installments
  due_date: string;         // YYYY-MM-DD
  amount: number;
  payment_id?: Identifier | null;
  created_at: string;
  // Denormalized from view / FakeRest generator
  contract_number?: string;
  case_type?: string;
  account_name?: string;
  account_number?: string;
  status?: 'upcoming' | 'due' | 'late' | 'paid';
} & Pick<RaRecord, "id">;

export type AccountPayment = {
  account_id: Identifier;
  contract_id?: Identifier | null;
  date_received: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  user_id?: Identifier | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type AccountActivity = {
  account_id: Identifier;
  parent_type?: string;
  parent_id?: Identifier;
  type?: string;
  subject: string;
  body?: string;
  date?: string;
  attachments?: AttachmentNote[];
  created_at: string;
  user_id?: Identifier | null;
} & Pick<RaRecord, "id">;
