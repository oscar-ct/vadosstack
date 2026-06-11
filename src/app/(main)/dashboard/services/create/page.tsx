import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

import { ServiceWorkspace } from "../_components/service-workspace";
import { createServiceTemplateAction } from "../actions";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to create services"
        description="Reusable service templates are private to each signed-in account."
      />
    );
  }

  return <ServiceWorkspace action={createServiceTemplateAction} mode="create" />;
}
