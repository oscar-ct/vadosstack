import { notFound } from "next/navigation";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getPermittedDashboardAuthorization } from "@/lib/authorization";

import { EmailTemplateEditor } from "../../_components/email-template-editor";
import { getEmailTemplate } from "../../_lib/template-data";
import { deleteEmailTemplateAction, updateEmailTemplateAction } from "../../actions";

export default async function Page({
  params,
}: {
  params: Promise<{
    templateId: string;
  }>;
}) {
  const authorization = await getPermittedDashboardAuthorization("email.templates.manage");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to edit email templates"
        description="Reusable email templates are private to each signed-in account."
      />
    );
  }

  const { templateId } = await params;
  const template = await getEmailTemplate(authorization.workspaceId, templateId);

  if (!template) {
    notFound();
  }

  return (
    <EmailTemplateEditor
      action={updateEmailTemplateAction}
      deleteAction={deleteEmailTemplateAction}
      mode="edit"
      template={template}
    />
  );
}
