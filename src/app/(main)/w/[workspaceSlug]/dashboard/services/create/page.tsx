import { AuthRequiredState } from "@/components/auth-required-state";
import { getPermittedDashboardAuthorization } from "@/lib/authorization";

import { ServiceWorkspace } from "../_components/service-workspace";
import { createServiceTemplateAction } from "../actions";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("services.manage");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Service management access required"
        description="You do not have permission to create services in this workspace."
      />
    );
  }

  return <ServiceWorkspace action={createServiceTemplateAction} mode="create" />;
}
