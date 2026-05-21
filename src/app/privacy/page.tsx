import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { PolicyPage } from "../(external)/_components/policy-page";

const title = "Privacy Policy";
const description =
  "How VadosStack handles account, business, and product usage information for customers using the service.";

export const metadata: Metadata = {
  title,
  description,
};

const sections = [
  {
    title: "Information We Collect",
    body: [
      "We collect the information needed to create and operate your VadosStack account, including your name, email address, company name, authentication details, and basic account preferences.",
      "When you use the product, you may enter business information such as customers, jobs, estimates, invoices, service templates, employees, time entries, notes, phone numbers, addresses, and uploaded company assets.",
      "We may collect technical information such as device type, browser, IP address, pages visited, timestamps, and error details to help keep the service secure and reliable.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "We use your information to provide the dashboard, sign-in, customer management, job tracking, estimating, invoicing, employee time tracking, support, security, and account administration features.",
      "We also use information to improve product performance, troubleshoot issues, prevent abuse, and communicate with you about your account or important service updates.",
      "We do not sell your personal information.",
    ],
  },
  {
    title: "Google Sign-In and Gmail Sending",
    body: [
      "If you sign in with Google, we use Google OAuth to confirm your identity and receive basic profile information such as your email address and name.",
      "If you choose to connect Gmail for invoice sending, we request the Gmail send-only permission, https://www.googleapis.com/auth/gmail.send. We use that permission only to send invoice emails that you initiate from VadosStack.",
      "VadosStack does not use Gmail access to read, search, download, modify, delete, or monitor your mailbox. We do not use Gmail data for advertising, user profiling, model training, or any purpose unrelated to sending invoice emails you request.",
      "To keep the feature connected, we store an encrypted Google refresh token associated with your VadosStack account. This token is used to request temporary Gmail access tokens for sending invoice emails. We do not store your Google password.",
      "You can revoke VadosStack's Google access at any time from your Google Account permissions. After access is revoked, Gmail invoice sending may stop working until you reconnect Gmail.",
      "VadosStack's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements. We do not sell Google user data or transfer it except as needed to provide the connected feature, comply with law, protect users, or operate secure service providers under appropriate confidentiality obligations.",
    ],
  },
  {
    title: "Sharing and Service Providers",
    body: [
      "We may share information with trusted service providers that help us host, operate, secure, analyze, or support VadosStack. These providers are expected to use information only for the services they provide to us.",
      "We may also disclose information when required by law, to protect the rights and safety of users, or to investigate misuse of the service.",
    ],
  },
  {
    title: "Data Retention and Security",
    body: [
      "We keep account and business information for as long as needed to provide the service, meet legal obligations, resolve disputes, or enforce agreements.",
      "We use reasonable administrative, technical, and organizational safeguards designed to protect your information. No internet service can guarantee absolute security, but we work to keep risk low and respond quickly to issues.",
    ],
  },
  {
    title: "Your Choices",
    body: [
      "You may update account and company information inside the product where those controls are available. You may also contact us to request access, correction, export, or deletion of your account information.",
      "Some information may need to be retained when required for security, legal, billing, backup, or legitimate business reasons.",
    ],
  },
  {
    title: "Contact",
    body: [
      `Questions about this Privacy Policy can be sent through the normal support channel for ${APP_CONFIG.name}. If a dedicated privacy contact is added later, this page should be updated with that address.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      title={title}
      eyebrow="Privacy first, plainly stated"
      description={description}
      lastUpdated="May 21, 2026"
      sections={sections}
    />
  );
}
