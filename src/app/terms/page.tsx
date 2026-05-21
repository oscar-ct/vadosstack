import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { PolicyPage } from "../(external)/_components/policy-page";

const title = "Terms of Service";
const description =
  "Basic terms for using VadosStack to manage customers, jobs, estimates, invoices, services, and employee time.";

export const metadata: Metadata = {
  title,
  description,
};

const sections = [
  {
    title: "Agreement to These Terms",
    body: [
      `These Terms of Service describe the basic rules for using ${APP_CONFIG.name}. By creating an account, signing in, or using the service, you agree to follow these terms.`,
      "If you use the service on behalf of a company, you confirm that you have authority to accept these terms for that company.",
    ],
  },
  {
    title: "Use of the Service",
    body: [
      "VadosStack provides software tools for service businesses, including customer management, job tracking, estimates, invoices, service templates, company settings, and employee time tracking.",
      "You are responsible for the information you enter, the accuracy of business records you create, and how you use exported or generated documents with your customers, employees, vendors, or tax professionals.",
    ],
  },
  {
    title: "Accounts and Security",
    body: [
      "You are responsible for keeping your account credentials secure and for activity that happens under your account.",
      "If you believe your account has been accessed without permission, you should notify support promptly and take reasonable steps to secure your email and authentication methods.",
    ],
  },
  {
    title: "Acceptable Use",
    body: [
      "You may not use VadosStack to break the law, infringe the rights of others, upload malicious code, interfere with the service, attempt unauthorized access, or misuse customer, employee, or payment-related information.",
      "We may limit, suspend, or terminate access if we reasonably believe an account is being used in a harmful, unlawful, or abusive way.",
    ],
  },
  {
    title: "Customer Data",
    body: [
      "You retain responsibility for your business data. VadosStack uses that data to provide and improve the service, support your account, maintain security, and meet legal obligations.",
      "You should only enter data that you have the right to use and process. You are responsible for any notices, permissions, or consents required for your customers, employees, or business contacts.",
    ],
  },
  {
    title: "Email Sending and Gmail Integration",
    body: [
      "If you connect Gmail, VadosStack may send invoice emails from your connected Google account when you choose to use the email invoice feature.",
      "You are responsible for the accuracy of invoice content, recipient email addresses, customer information, payment details, and any message sent through your connected email account.",
      "The Gmail integration is intended for transactional invoice-related messages to your customers. You may not use it for spam, bulk marketing, deceptive messages, unlawful content, harassment, or messages that violate Google policies or applicable email laws.",
      "You can revoke Gmail access through your Google Account permissions. If access is revoked, disconnected, or rejected by Google, invoice email sending may be unavailable until you reconnect the account.",
    ],
  },
  {
    title: "Availability and Changes",
    body: [
      "We work to keep VadosStack reliable, but the service may occasionally be unavailable due to maintenance, updates, outages, security work, or factors outside our control.",
      "We may change, add, or remove features over time. When a change materially affects users, we aim to communicate it in a reasonable way.",
    ],
  },
  {
    title: "Disclaimers and Liability",
    body: [
      "VadosStack is provided as business management software. It is not legal, tax, accounting, payroll, or financial advice.",
      "To the extent allowed by law, the service is provided without warranties of any kind, and VadosStack is not liable for indirect, incidental, special, consequential, or punitive damages.",
    ],
  },
  {
    title: "Contact",
    body: [
      `Questions about these Terms can be sent through the normal support channel for ${APP_CONFIG.name}. If a dedicated legal contact is added later, this page should be updated with that address.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      title={title}
      eyebrow="Clear terms for everyday use"
      description={description}
      lastUpdated="May 21, 2026"
      sections={sections}
    />
  );
}
