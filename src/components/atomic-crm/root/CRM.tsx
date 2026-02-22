import {
  type CoreAdminProps,
  CustomRoutes,
  localStorageStore,
  Resource,
  type AuthProvider,
  type DataProvider,
} from "ra-core";
import { useEffect } from "react";
import { Route } from "react-router";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { Admin } from "@/components/admin/admin";
import { ForgotPasswordPage } from "@/components/supabase/forgot-password-page";
import { SetPasswordPage } from "@/components/supabase/set-password-page";
import { OAuthConsentPage } from "@/components/supabase/oauth-consent-page";

import accounts from "../accounts";
import companies from "../companies";
import contacts from "../contacts";
import accountContactViews from "../account-contacts";
import contractViews from "../contracts";
import taskViews from "../tasks";
import { Dashboard } from "../dashboard/Dashboard";
import { MobileDashboard } from "../dashboard/MobileDashboard";
import deals from "../deals";
import { Layout } from "../layout/Layout";
import { MobileLayout } from "../layout/MobileLayout";
import { SignupPage } from "../login/SignupPage";
import { ConfirmationRequired } from "../login/ConfirmationRequired";
import { ImportPage } from "../misc/ImportPage";
import {
  authProvider as defaultAuthProvider,
  dataProvider as defaultDataProvider,
} from "../providers/supabase";
import users from "../users";
import { SettingsPage } from "../settings/SettingsPage";
import type { ConfigurationContextValue } from "./ConfigurationContext";
import { ConfigurationProvider } from "./ConfigurationContext";
import {
  defaultAccountCategories,
  defaultCaseTypes,
  defaultCompanySectors,
  defaultContactGender,
  defaultContractStatuses,
  defaultDarkModeLogo,
  defaultDealCategories,
  defaultDealPipelineStatuses,
  defaultDealStages,
  defaultLightModeLogo,
  defaultNoteStatuses,
  defaultPaymentMethods,
  defaultTaskStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "./defaultConfiguration";
import { i18nProvider } from "./i18nProvider";
import { StartPage } from "../login/StartPage.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { MobileTasksList } from "../tasks/MobileTasksList.tsx";
import { MobileAccountsList } from "../accounts/MobileAccountsList.tsx";
import { AccountShow } from "../accounts/AccountShow.tsx";
import { AccountCreate } from "../accounts/AccountCreate.tsx";
import { ContactList as MobileContactsList } from "../account-contacts/ContactList.tsx";
import { ContactShow as AccountContactShow } from "../account-contacts/ContactShow.tsx";
import { ContactCreate as AccountContactCreate } from "../account-contacts/ContactCreate.tsx";
import { ContactEdit as AccountContactEdit } from "../account-contacts/ContactEdit.tsx";
import { MobileContractsList } from "../contracts/MobileContractsList.tsx";
import { ContractShow } from "../contracts/ContractShow.tsx";
import { ContractCreate } from "../contracts/ContractCreate.tsx";
import { NoteShowPage } from "../notes/NoteShowPage.tsx";

export type CRMProps = {
  dataProvider?: DataProvider;
  authProvider?: AuthProvider;
  disableTelemetry?: boolean;
} & Partial<ConfigurationContextValue>;

/**
 * CRM Component
 *
 * This component sets up and renders the main CRM application using `ra-core`. It provides
 * default configurations and themes but allows for customization through props. The component
 * wraps the application with a `ConfigurationProvider` to provide configuration values via context.
 *
 * @param {Array<ContactGender>} contactGender - The gender options for contacts used in the application.
 * @param {string[]} companySectors - The list of company sectors used in the application.
 * @param {RaThemeOptions} darkTheme - The theme to use when the application is in dark mode.
 * @param {string[]} dealCategories - The categories of deals used in the application.
 * @param {string[]} dealPipelineStatuses - The statuses of deals in the pipeline used in the application.
 * @param {DealStage[]} dealStages - The stages of deals used in the application.
 * @param {RaThemeOptions} lightTheme - The theme to use when the application is in light mode.
 * @param {string} logo - The logo used in the CRM application.
 * @param {NoteStatus[]} noteStatuses - The statuses of notes used in the application.
 * @param {string[]} taskTypes - The types of tasks used in the application.
 * @param {string} title - The title of the CRM application.
 *
 * @returns {JSX.Element} The rendered CRM application.
 *
 * @example
 * // Basic usage of the CRM component
 * import { CRM } from '@/components/atomic-crm/dashboard/CRM';
 *
 * const App = () => (
 *     <CRM
 *         logo="/path/to/logo.png"
 *         title="My Custom CRM"
 *         lightTheme={{
 *             ...defaultTheme,
 *             palette: {
 *                 primary: { main: '#0000ff' },
 *             },
 *         }}
 *     />
 * );
 *
 * export default App;
 */
export const CRM = ({
  accountCategories = defaultAccountCategories,
  caseTypes = defaultCaseTypes,
  contactGender = defaultContactGender,
  companySectors = defaultCompanySectors,
  contractStatuses = defaultContractStatuses,
  dealCategories = defaultDealCategories,
  dealPipelineStatuses = defaultDealPipelineStatuses,
  dealStages = defaultDealStages,
  darkModeLogo = defaultDarkModeLogo,
  lightModeLogo = defaultLightModeLogo,
  noteStatuses = defaultNoteStatuses,
  paymentMethods = defaultPaymentMethods,
  taskStatuses = defaultTaskStatuses,
  taskTypes = defaultTaskTypes,
  title = defaultTitle,
  dataProvider = defaultDataProvider,
  authProvider = defaultAuthProvider,
  googleWorkplaceDomain = import.meta.env.VITE_GOOGLE_WORKPLACE_DOMAIN,
  disableEmailPasswordAuthentication = import.meta.env
    .VITE_DISABLE_EMAIL_PASSWORD_AUTHENTICATION === "true",
  disableTelemetry,
  ...rest
}: CRMProps) => {
  useEffect(() => {
    if (
      disableTelemetry ||
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      typeof window.location === "undefined" ||
      typeof Image === "undefined"
    ) {
      return;
    }
    const img = new Image();
    img.src = `https://atomic-crm-telemetry.marmelab.com/atomic-crm-telemetry?domain=${window.location.hostname}`;
  }, [disableTelemetry]);

  const isMobile = useIsMobile();

  const ResponsiveAdmin = isMobile ? MobileAdmin : DesktopAdmin;

  return (
    <ConfigurationProvider
      accountCategories={accountCategories}
      caseTypes={caseTypes}
      contactGender={contactGender}
      companySectors={companySectors}
      contractStatuses={contractStatuses}
      dealCategories={dealCategories}
      dealPipelineStatuses={dealPipelineStatuses}
      dealStages={dealStages}
      darkModeLogo={darkModeLogo}
      lightModeLogo={lightModeLogo}
      noteStatuses={noteStatuses}
      paymentMethods={paymentMethods}
      taskStatuses={taskStatuses}
      taskTypes={taskTypes}
      title={title}
      googleWorkplaceDomain={googleWorkplaceDomain}
      disableEmailPasswordAuthentication={disableEmailPasswordAuthentication}
    >
      <ResponsiveAdmin
        dataProvider={dataProvider}
        authProvider={authProvider}
        i18nProvider={i18nProvider}
        store={localStorageStore(undefined, "CRM")}
        loginPage={StartPage}
        requireAuth
        disableTelemetry
        {...rest}
      />
    </ConfigurationProvider>
  );
};

const DesktopAdmin = (props: CoreAdminProps) => {
  return (
    <Admin layout={Layout} dashboard={Dashboard} {...props}>
      <CustomRoutes noLayout>
        <Route path={SignupPage.path} element={<SignupPage />} />
        <Route
          path={ConfirmationRequired.path}
          element={<ConfirmationRequired />}
        />
        <Route path={SetPasswordPage.path} element={<SetPasswordPage />} />
        <Route
          path={ForgotPasswordPage.path}
          element={<ForgotPasswordPage />}
        />
        <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
      </CustomRoutes>

      <CustomRoutes>
        <Route path={SettingsPage.path} element={<SettingsPage />} />
        <Route path={ImportPage.path} element={<ImportPage />} />
      </CustomRoutes>
      <Resource name="accounts" {...accounts} />
      <Resource name="account_contacts" {...accountContactViews} />
      <Resource name="account_contracts" {...contractViews} />
      <Resource name="account_payments" />
      <Resource name="account_activities" />
      <Resource name="contact_types" />
      <Resource name="deals" {...deals} />
      <Resource name="contacts" />
      <Resource name="companies" {...companies} />
      <Resource name="contact_notes" />
      <Resource name="deal_notes" />
      <Resource name="tasks" {...taskViews} />
      <Resource name="users" {...users} />
      <Resource name="tags" />
    </Admin>
  );
};

const MobileAdmin = (props: CoreAdminProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        networkMode: "offlineFirst",
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });
  const asyncStoragePersister = createAsyncStoragePersister({
    storage: localStorage,
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <Admin
        queryClient={queryClient}
        layout={MobileLayout}
        dashboard={MobileDashboard}
        {...props}
      >
        <CustomRoutes noLayout>
          <Route path={SignupPage.path} element={<SignupPage />} />
          <Route
            path={ConfirmationRequired.path}
            element={<ConfirmationRequired />}
          />
          <Route path={SetPasswordPage.path} element={<SetPasswordPage />} />
          <Route
            path={ForgotPasswordPage.path}
            element={<ForgotPasswordPage />}
          />
          <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
        </CustomRoutes>
        <Resource name="accounts" list={MobileAccountsList} show={AccountShow} create={AccountCreate} recordRepresentation={accounts.recordRepresentation} />
        <Resource
          name="account_contacts"
          list={MobileContactsList}
          show={AccountContactShow}
          create={AccountContactCreate}
          edit={AccountContactEdit}
          recordRepresentation={accountContactViews.recordRepresentation}
        >
          <Route path=":id/notes/:noteId" element={<NoteShowPage />} />
        </Resource>
        <Resource name="account_contracts" list={MobileContractsList} show={ContractShow} create={ContractCreate} recordRepresentation={contractViews.recordRepresentation} />
        <Resource name="account_payments" />
        <Resource name="account_activities" />
        <Resource name="contact_types" />
        <Resource name="tasks" list={MobileTasksList} />
        <Resource name="users" />
        <Resource name="tags" />
      </Admin>
    </PersistQueryClientProvider>
  );
};
