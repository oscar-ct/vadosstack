import { AuthRequiredState } from "@/components/auth-required-state";
import { getPermittedDashboardAuthorization } from "@/lib/authorization";

import { EmailTemplateEditor } from "../_components/email-template-editor";
import { createEmailTemplateAction } from "../actions";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("email.templates.manage");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to create email templates"
        description="Reusable email templates are private to each signed-in account."
      />
    );
  }

  return <EmailTemplateEditor action={createEmailTemplateAction} mode="create" />;
}
