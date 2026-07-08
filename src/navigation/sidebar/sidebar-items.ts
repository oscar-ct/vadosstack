import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
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
        title: "Command Center",
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
        title: "Services",
        url: "/dashboard/services",
        icon: PackageCheck,
      },
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
    id: 4,
    label: "Money",
    items: [
      {
        title: "Invoices",
        url: "/dashboard/invoices",
        icon: ReceiptText,
      },
    ],
  },
  {
    id: 5,
    label: "E-commerce",
    items: [
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
        title: "Users",
        url: "/dashboard/admin/users",
        icon: ShieldCheck,
        adminOnly: true,
      },
    ],
  },
];
