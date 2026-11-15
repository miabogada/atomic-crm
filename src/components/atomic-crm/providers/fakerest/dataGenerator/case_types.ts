import type { CaseType } from "../../../types";
import type { Db } from "./types";

// Demo copy of the case_types seed in supabase/migrations/20261108000000_case_types.sql
// and 20261115000000_case_types_i90_birth_certificate.sql.
// In production the list lives in the case_types table.
export const caseTypeNames = [
  "Adjustment of Status",
  "Adjustment of Status (No Representation)",
  "Advance Parole",
  "Asylum",
  "BIA Appeal",
  "Birth Certificate Amendment",
  "Cancellation of Removal",
  "Citizenship Inquiry",
  "Court Representation",
  "DACA",
  "DACA Renewal",
  "Deportation",
  "EAD",
  "EAD Renewal",
  "FBI",
  "FOIA",
  "Humanitarian Parole",
  "I-130",
  "I-131F / Family Reunification Parole",
  "I-192",
  "I-212",
  "I-601 Waiver",
  "I-601A",
  "I-751",
  "I-824",
  "I-90",
  "Inquiry",
  "K Visa",
  "Late Amnesty",
  "Legalization",
  "Letter",
  "Military Parole in Place",
  "Motion to Close",
  "Motion to Reopen",
  "Motion to Terminate",
  "N-400",
  "N-400 (No Representation)",
  "NACARA",
  "Non-Client Consult",
  "NVC & Consular Processing",
  "Review File",
  "Suspension of Deportation",
  "T Visa",
  "T-2 Visa",
  "T-4 Visa",
  "TPS",
  "TPS Renewal",
  "U Visa",
  "U-2 Visa",
  "U-4 Visa",
  "V Visa",
  "VAWA",
];

export const generateCaseTypes = (_db: Db): CaseType[] =>
  caseTypeNames.map((name, i) => ({
    id: i + 1,
    name,
    active: true,
    created_at: new Date().toISOString(),
  }));

/** Emulates the account_contracts_summary view columns for FakeRest. */
export const caseTypeViewFields = (
  caseTypes: CaseType[],
  ids: (string | number)[] | undefined,
  legacy?: string,
) => {
  const names = (ids ?? [])
    .map((id) => caseTypes.find((t) => String(t.id) === String(id))?.name)
    .filter((n): n is string => !!n)
    .sort();
  return {
    case_type_names: names,
    case_types_label: names.length ? names.join(", ") : (legacy ?? null),
  };
};
