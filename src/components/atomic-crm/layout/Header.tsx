import { FileText, Import, Settings, User } from "lucide-react";
import { CanAccess, useGetIdentity, useUserMenu } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { ImportPage } from "../misc/ImportPage";
import { InvoicesPage } from "../invoices/InvoicesPage";

const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const { identity } = useGetIdentity();
  const isAdmin = !!identity?.administrator;

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/accounts/*", location.pathname)) {
    currentPath = "/accounts";
  } else if (matchPath("/account_contracts/*", location.pathname)) {
    currentPath = "/account_contracts";
  } else if (matchPath("/tasks/*", location.pathname)) {
    currentPath = "/tasks";
  } else if (matchPath("/account_contacts/*", location.pathname)) {
    currentPath = "/account_contacts";
  } else {
    currentPath = false;
  }

  return (
    <>
      <nav className="grow">
        <header className="bg-secondary">
          <div className="px-4">
            <div className="flex justify-between items-center flex-1">
              <Link
                to={isAdmin ? "/" : "/accounts"}
                className="flex items-center gap-2 text-secondary-foreground no-underline"
              >
                <img
                  className="[.light_&]:hidden h-6"
                  src={darkModeLogo}
                  alt={title}
                />
                <img
                  className="[.dark_&]:hidden h-6"
                  src={lightModeLogo}
                  alt={title}
                />
                <h1 className="text-xl font-semibold">{title}</h1>
              </Link>
              <div>
                <nav className="flex">
                  {isAdmin && (
                    <NavigationTab
                      label="Dashboard"
                      to="/"
                      isActive={currentPath === "/"}
                    />
                  )}
                  <NavigationTab
                    label="Accounts"
                    to="/accounts"
                    isActive={currentPath === "/accounts"}
                  />
                  <NavigationTab
                    label="Contracts"
                    to="/account_contracts"
                    isActive={currentPath === "/account_contracts"}
                  />
                  <NavigationTab
                    label="Tasks"
                    to="/tasks"
                    isActive={currentPath === "/tasks"}
                  />
                  <NavigationTab
                    label="Contacts"
                    to="/account_contacts"
                    isActive={currentPath === "/account_contacts"}
                  />
                </nav>
              </div>
              <div className="flex items-center">
                <ThemeModeToggle />
                <RefreshButton />
                <UserMenu>
                  <ConfigurationMenu />
                  <CanAccess resource="users" action="list">
                    <UsersMenu />
                  </CanAccess>
                  {isAdmin && <InvoicesMenuItem />}
                  <ImportFromJsonMenuItem />
                </UserMenu>
              </div>
            </div>
          </div>
        </header>
      </nav>
    </>
  );
};

const NavigationTab = ({
  label,
  to,
  isActive,
}: {
  label: string;
  to: string;
  isActive: boolean;
}) => (
  <Link
    to={to}
    className={`px-3 lg:px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? "text-secondary-foreground border-secondary-foreground"
        : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"
    }`}
  >
    {label}
  </Link>
);

const UsersMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<UsersMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/users" className="flex items-center gap-2">
        <User /> Users
      </Link>
    </DropdownMenuItem>
  );
};

const ConfigurationMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ConfigurationMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/settings" className="flex items-center gap-2">
        <Settings />
        My info
      </Link>
    </DropdownMenuItem>
  );
};

const InvoicesMenuItem = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<InvoicesMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={InvoicesPage.path} className="flex items-center gap-2">
        <FileText /> Invoices
      </Link>
    </DropdownMenuItem>
  );
};

const ImportFromJsonMenuItem = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ImportFromJsonMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={ImportPage.path} className="flex items-center gap-2">
        <Import /> Import data
      </Link>
    </DropdownMenuItem>
  );
};
export default Header;
