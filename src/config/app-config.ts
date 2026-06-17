import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "VadosStack",
  version: packageJson.version,
  copyright: `© ${currentYear}, VadosStack.`,
  meta: {
    title: "VadosStack | Management Software for Service Businesses",
    description:
      "Save time with focused management software built for service businesses and contractors. Manage leads, customers, jobs, estimates, invoices, service templates, rich email templates, and employee time history in one dashboard.",
  },
};
