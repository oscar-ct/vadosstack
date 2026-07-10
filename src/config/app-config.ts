import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "VadosStack",
  version: packageJson.version,
  copyright: `© ${currentYear}, VadosStack.`,
  meta: {
    title: "VadosStack | Field Service Management Software",
    description:
      "Run your service business in one focused workspace. Manage customers, jobs, estimates, invoices, employee time, orders, inventory, email, and reporting.",
  },
};
