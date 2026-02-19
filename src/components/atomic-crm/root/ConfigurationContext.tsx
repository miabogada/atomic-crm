import { createContext, useContext, type ReactNode } from "react";

import type { ContactGender, DealStage, NoteStatus } from "../types";
import {
  defaultAccountCategories,
  defaultCaseTypes,
  defaultCompanySectors,
  defaultContactGender,
  defaultDarkModeLogo,
  defaultDealCategories,
  defaultDealPipelineStatuses,
  defaultDealStages,
  defaultLightModeLogo,
  defaultNoteStatuses,
  defaultTaskStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "./defaultConfiguration";

// Define types for the context value
export interface ConfigurationContextValue {
  accountCategories: string[];
  caseTypes: string[];
  companySectors: string[];
  dealCategories: string[];
  dealPipelineStatuses: string[];
  dealStages: DealStage[];
  noteStatuses: NoteStatus[];
  taskStatuses: string[];
  taskTypes: string[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  contactGender: ContactGender[];
  googleWorkplaceDomain?: string;
  disableEmailPasswordAuthentication?: boolean;
}

export interface ConfigurationProviderProps extends ConfigurationContextValue {
  children: ReactNode;
}

// Create context with default value
// eslint-disable-next-line react-refresh/only-export-components
export const ConfigurationContext = createContext<ConfigurationContextValue>({
  accountCategories: defaultAccountCategories,
  caseTypes: defaultCaseTypes,
  companySectors: defaultCompanySectors,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskStatuses: defaultTaskStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
  contactGender: defaultContactGender,
  disableEmailPasswordAuthentication: false,
});

export const ConfigurationProvider = ({
  children,
  accountCategories,
  caseTypes,
  companySectors,
  dealCategories,
  dealPipelineStatuses,
  dealStages,
  darkModeLogo,
  lightModeLogo,
  noteStatuses,
  taskStatuses,
  taskTypes,
  title,
  contactGender,
  googleWorkplaceDomain,
  disableEmailPasswordAuthentication,
}: ConfigurationProviderProps) => (
  <ConfigurationContext.Provider
    value={{
      accountCategories,
      caseTypes,
      companySectors,
      dealCategories,
      dealPipelineStatuses,
      dealStages,
      darkModeLogo,
      lightModeLogo,
      noteStatuses,
      title,
      taskStatuses,
      taskTypes,
      contactGender,
      googleWorkplaceDomain,
      disableEmailPasswordAuthentication,
    }}
  >
    {children}
  </ConfigurationContext.Provider>
);

// eslint-disable-next-line react-refresh/only-export-components
export const useConfigurationContext = () => useContext(ConfigurationContext);
