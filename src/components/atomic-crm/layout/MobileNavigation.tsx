import { useTheme } from "@/components/admin/use-theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  Activity,
  Building2,
  DollarSign,
  FileText,
  Home,
  ListTodo,
  LogOut,
  MoreHorizontal,
  Moon,
  Plus,
  Smartphone,
  Sun,
  Users,
} from "lucide-react";
import {
  Translate,
  useAuthProvider,
  useGetIdentity,
  useGetOne,
  useLogout,
} from "ra-core";
import { Link, matchPath, useLocation, useNavigate } from "react-router";
import { useState } from "react";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import { AccountCreateSheet } from "../accounts/AccountCreateSheet";
import { ActivityCreateSheet } from "../accounts/ActivityCreateSheet";
import { ContactCreateSheet } from "../account-contacts/ContactCreateSheet";
import { ContractCreateSheet } from "../contracts/ContractCreateSheet";
import { PaymentCreateSheet } from "../payments/PaymentCreateSheet";
import type { AccountContract } from "../types";

export const MobileNavigation = () => {
  const location = useLocation();

  // Hide the nav entirely on edit and create form pages — FormToolbar handles the bottom actions
  const isFormRoute =
    !!matchPath("/:resource/:id/edit", location.pathname) ||
    !!matchPath("/:resource/create", location.pathname);
  if (isFormRoute) return null;

  const contractShowMatch = matchPath(
    "/account_contracts/:id/show",
    location.pathname,
  );
  const contractShowId = contractShowMatch?.params?.id ?? null;

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/accounts/*", location.pathname)) {
    currentPath = "/accounts";
  } else if (matchPath("/account_contacts/*", location.pathname)) {
    currentPath = "/account_contacts";
  } else if (contractShowMatch) {
    currentPath = "/account_contracts/show";
  } else if (matchPath("/account_contracts/*", location.pathname)) {
    currentPath = "/account_contracts";
  } else if (matchPath("/tasks/*", location.pathname)) {
    currentPath = "/tasks";
  } else {
    currentPath = false;
  }

  const isMoreActive =
    currentPath === "/account_contacts" ||
    currentPath === "/account_contracts" ||
    currentPath === "/account_contracts/show";

  // Check if the app is running as a PWA (standalone mode)
  const isPwa = window.matchMedia("(display-mode: standalone)").matches;
  // Check if it's iOS on the web
  const isWebiOS = /iPad|iPod|iPhone/.test(window.navigator.userAgent);

  return (
    <nav
      aria-label="CRM navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-secondary h-14"
      style={{
        // iOS bug: even though viewport is set correctly, the bottom safe area inset is not accounted for
        // So we manually add some padding to avoid the navigation being too close to the home bar
        paddingBottom: isPwa && isWebiOS ? 15 : undefined,
        // We use box-sizing: border-box, so the height contains the padding.
        // To actually increase the padding, we need to increase the height as well
        height:
          "calc(var(--spacing)) * 6" + (isPwa && isWebiOS ? " + 15px" : ""),
      }}
    >
      <div className="flex justify-center">
        <>
          <NavigationButton
            href="/"
            Icon={Home}
            label="Home"
            isActive={currentPath === "/"}
          />
          <NavigationButton
            href="/accounts"
            Icon={Building2}
            label="Accounts"
            isActive={currentPath === "/accounts"}
          />
          <CreateButton currentPath={currentPath} contractShowId={contractShowId} />
          <NavigationButton
            href="/tasks"
            Icon={ListTodo}
            label="Tasks"
            isActive={currentPath === "/tasks"}
          />
          <MoreButton isActive={isMoreActive} currentPath={currentPath} />
        </>
      </div>
    </nav>
  );
};

const NavigationButton = ({
  href,
  Icon,
  label,
  isActive,
}: {
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive: boolean;
}) => (
  <Button
    asChild
    variant="ghost"
    className={cn(
      "flex-col gap-1 h-auto py-2 px-1 rounded-md w-14 sm:w-16",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Link to={href}>
      <Icon className="size-6" />
      <span className="text-[0.6rem] font-medium">{label}</span>
    </Link>
  </Button>
);

const Fab = ({
  onClick,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  "aria-label": string;
}) => (
  <Button
    variant="default"
    size="icon"
    className="h-16 w-16 rounded-full -mt-3"
    aria-label={ariaLabel}
    onClick={onClick}
  >
    <Plus className="size-10" />
  </Button>
);

const CreateButton = ({
  currentPath,
  contractShowId,
}: {
  currentPath: string | boolean;
  contractShowId: string | null;
}) => {
  const [accountCreateOpen, setAccountCreateOpen] = useState(false);
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [contractCreateOpen, setContractCreateOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);

  // No FAB on dashboard or unknown pages
  if (currentPath === "/" || currentPath === false) {
    return <div className="w-14 sm:w-16" />;
  }

  if (currentPath === "/accounts") {
    return (
      <>
        <AccountCreateSheet open={accountCreateOpen} onOpenChange={setAccountCreateOpen} />
        <Fab aria-label="Add Account" onClick={() => setAccountCreateOpen(true)} />
      </>
    );
  }
  if (currentPath === "/account_contacts") {
    return (
      <>
        <ContactCreateSheet open={contactCreateOpen} onOpenChange={setContactCreateOpen} />
        <Fab aria-label="Add Contact" onClick={() => setContactCreateOpen(true)} />
      </>
    );
  }
  if (currentPath === "/account_contracts/show" && contractShowId) {
    return <ContractContextFab contractId={contractShowId} />;
  }
  if (currentPath === "/account_contracts") {
    return (
      <>
        <ContractCreateSheet open={contractCreateOpen} onOpenChange={setContractCreateOpen} />
        <Fab aria-label="Add Contract" onClick={() => setContractCreateOpen(true)} />
      </>
    );
  }
  if (currentPath === "/tasks") {
    return (
      <>
        <TaskCreateSheet open={taskCreateOpen} onOpenChange={setTaskCreateOpen} />
        <Fab aria-label="Add Task" onClick={() => setTaskCreateOpen(true)} />
      </>
    );
  }

  return <div className="w-14 sm:w-16" />;
};

const ContractContextFab = ({ contractId }: { contractId: string }) => {
  const { data: contract } = useGetOne<AccountContract>("account_contracts", {
    id: contractId,
  });
  const [taskOpen, setTaskOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (!contract) return <div className="w-14 sm:w-16" />;

  return (
    <>
      <TaskCreateSheet
        open={taskOpen}
        onOpenChange={setTaskOpen}
        account_id={contract.account_id}
        parent_type="account_contract"
        parent_id={contract.id}
      />
      <ActivityCreateSheet
        open={activityOpen}
        onOpenChange={setActivityOpen}
        account_id={contract.account_id}
        parent_type="account_contract"
        parent_id={contract.id}
      />
      <PaymentCreateSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        account_id={contract.account_id}
        contract_id={contract.id}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className="h-16 w-16 rounded-full -mt-3"
            aria-label="Add"
          >
            <Plus className="size-10" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top">
          <DropdownMenuItem
            className="h-12 px-4 text-base gap-3"
            onSelect={() => setTaskOpen(true)}
          >
            <ListTodo className="size-5" />
            Task
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base gap-3"
            onSelect={() => setActivityOpen(true)}
          >
            <Activity className="size-5" />
            Activity
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base gap-3"
            onSelect={() => setPaymentOpen(true)}
          >
            <DollarSign className="size-5" />
            Payment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

const MoreButton = ({
  isActive,
  currentPath,
}: {
  isActive: boolean;
  currentPath: string | boolean;
}) => {
  const authProvider = useAuthProvider();
  const { data: identity } = useGetIdentity();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!authProvider) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex-col gap-1 h-auto py-2 px-1 rounded-md w-14 sm:w-16",
            isActive ? null : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="size-6" />
          <span className="text-[0.6rem] font-medium">More</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <DropdownMenuItem
          className={cn("h-12 px-4 text-base gap-3", currentPath === "/account_contacts" && "font-semibold")}
          onSelect={() => navigate("/account_contacts")}
        >
          <Users className="size-5" />
          Contacts
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn("h-12 px-4 text-base gap-3", currentPath === "/account_contracts" && "font-semibold")}
          onSelect={() => navigate("/account_contracts")}
        >
          <FileText className="size-5" />
          Contracts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal h-12 px-4">
          <div className="flex flex-col justify-center h-full">
            <p className="text-base font-medium leading-none">
              {identity?.fullName}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeMenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="cursor-pointer h-12 px-4 text-base"
        >
          <LogOut />
          <Translate i18nKey="ra.auth.logout">Log out</Translate>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ThemeMenu = () => {
  const { theme, setTheme } = useTheme();
  return (
    <div className="px-3 py-2">
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(value) =>
          value && setTheme(value as "light" | "dark" | "system")
        }
        className="justify-start"
        size="lg"
        variant="outline"
      >
        <ToggleGroupItem
          value="system"
          aria-label="System theme"
          className="px-3"
        >
          <Smartphone className="size-5 mx-2" />
          <span className="sr-only">System</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="light"
          aria-label="Light theme"
          className="px-3"
        >
          <Sun className="size-5 mx-2" />
          <span className="sr-only">Light</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" aria-label="Dark theme" className="px-3">
          <Moon className="size-5 mx-2" />
          <span className="sr-only">Dark</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};
