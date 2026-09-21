import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  KeyRound,
  ListTodo,
  type LucideIcon,
  MailCheck,
  MailPlus,
  MessagesSquare,
  NotebookText,
  Package,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Timer,
  UserRoundCog,
  Users,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  adminOnly?: boolean;
  disabledReason?: string;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  adminOnly?: boolean;
  disabledReason?: string;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboard",
    items: [
      {
        title: "Overview",
        url: "/dashboard/overview",
        icon: ListTodo,
      },
      {
        title: "Calendar",
        url: "/dashboard/calendar",
        icon: CalendarDays,
      },
      {
        title: "Performance",
        url: "/dashboard/command-center",
        icon: ChartNoAxesCombined,
        isNew: true,
      },
    ],
  },
  {
    id: 2,
    label: "Customers",
    items: [
      {
        title: "Leads",
        url: "/dashboard/leads",
        icon: MessagesSquare,
        isNew: true,
      },
      {
        title: "Customers",
        url: "/dashboard/customers",
        icon: Users,
      },
    ],
  },
  {
    id: 3,
    label: "Work",
    items: [
      {
        title: "Estimates",
        url: "/dashboard/estimates",
        icon: NotebookText,
      },
      {
        title: "Jobs",
        url: "/dashboard/jobs",
        icon: BriefcaseBusiness,
      },
      {
        title: "Invoices",
        url: "/dashboard/invoices",
        icon: ReceiptText,
      },
      {
        title: "Services",
        url: "/dashboard/services",
        icon: PackageCheck,
      },
    ],
  },
  {
    id: 4,
    label: "People",
    items: [
      {
        title: "Time Tracking",
        url: "/dashboard/time-tracking",
        icon: Timer,
      },
      {
        title: "Employees",
        url: "/dashboard/employees",
        icon: UserRoundCog,
        isNew: true,
      },
    ],
  },
  {
    id: 5,
    label: "E-commerce",
    items: [
      {
        title: "Commerce Analytics",
        url: "/dashboard/commerce-pulse",
        icon: Activity,
        isNew: true,
      },
      {
        title: "Orders",
        url: "/dashboard/orders",
        icon: ShoppingCart,
      },
      {
        title: "Inventory",
        url: "/dashboard/inventory",
        icon: Package,
      },
    ],
  },
  {
    id: 6,
    label: "Email",
    items: [
      {
        title: "Email History",
        url: "/dashboard/email-history",
        icon: MailCheck,
      },
      {
        title: "Email Templates",
        url: "/dashboard/email-templates",
        icon: MailPlus,
        isNew: true,
      },
    ],
  },
  {
    id: 7,
    label: "Admin",
    items: [
      {
        title: "Roles & Permissions",
        url: "/dashboard/roles",
        icon: KeyRound,
        isNew: true,
      },
      {
        title: "Users",
        url: "/dashboard/admin/users",
        icon: ShieldCheck,
        adminOnly: true,
      },
    ],
  },
];
