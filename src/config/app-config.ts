import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "VadosStack",
  version: packageJson.version,
  copyright: `© ${currentYear}, VadosStack.`,
  meta: {
    title: "VadosStack | Management Software for Service Businesses",
    description:
      "Save time and increase productivity with simple management software built for service businesses and contractors. Manage customers, jobs, estimates, invoices, services, and employee time tracking in one dashboard.",
  },
};
