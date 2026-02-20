import type { ContactType } from "../../../types";
import type { Db } from "./types";

export const generateContactTypes = (_db: Db): ContactType[] => [
  { id: 1, name: "Petitioner" },
  { id: 2, name: "Beneficiary" },
  { id: 3, name: "Spouse" },
  { id: 4, name: "Child" },
  { id: 5, name: "Parent" },
  { id: 6, name: "Emergency Contact" },
];
