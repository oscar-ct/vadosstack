import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

import { EmailTemplateEditor } from "../_components/email-template-editor";
import { createEmailTemplateAction } from "../actions";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to create email templates"
        description="Reusable email templates are private to each signed-in account."
      />
    );
  }

  return <EmailTemplateEditor action={createEmailTemplateAction} mode="create" />;
}
