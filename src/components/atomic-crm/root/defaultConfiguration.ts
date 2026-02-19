import { Mars, NonBinary, Venus } from "lucide-react";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultTitle = "Clarklaw CRM";

export const defaultCompanySectors = [
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Financials",
  "Health Care",
  "Industrials",
  "Information Technology",
  "Materials",
  "Real Estate",
  "Utilities",
];

export const defaultDealStages = [
  { value: "opportunity", label: "Opportunity" },
  { value: "proposal-sent", label: "Proposal Sent" },
  { value: "in-negociation", label: "In Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "delayed", label: "Delayed" },
];

export const defaultDealPipelineStatuses = ["won"];

export const defaultDealCategories = [
  "Other",
  "Copywriting",
  "Print project",
  "UI Design",
  "Website design",
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "in-contract", label: "In Contract", color: "#a4e87d" },
];

export const defaultTaskTypes = [
  "None",
  "Email",
  "Call",
  "Meeting",
  "Follow-up",
  "Document Review",
  "Filing",
  "Court Date",
  "Client Request",
];

export const defaultCaseTypes = [
  "Adjustment of Status",
  "Consular Processing",
  "Naturalization",
  "Removal Defense",
  "Asylum",
  "VAWA",
  "U-Visa",
  "T-Visa",
  "DACA",
  "TPS",
  "Employment Authorization",
  "Family Petition",
  "Labor Certification",
  "H-1B",
  "L-1",
  "O-1",
  "Other",
];

export const defaultTaskStatuses = [
  "To do",
  "In Process",
  "Blocked",
  "Done",
];

export const defaultActivityTypes = [
  "call",
  "email",
  "meeting",
  "document",
  "note",
  "payment",
];

export const defaultContractStatuses = [
  "To do",
  "In process",
  "In process - Past due",
  "Stopped - Past due",
  "In process - Paid",
  "Done - Paid",
  "Canceled",
];

export const defaultAccountCategories = [
  "In Process",
  "Closed",
  "Archived",
  "Consultation Only",
];

export const defaultContactGender = [
  { value: "male", label: "He/Him", icon: Mars },
  { value: "female", label: "She/Her", icon: Venus },
  { value: "nonbinary", label: "They/Them", icon: NonBinary },
];
