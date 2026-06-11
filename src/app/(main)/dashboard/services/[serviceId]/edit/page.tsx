import { notFound } from "next/navigation";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

import { ServiceWorkspace } from "../../_components/service-workspace";
import { getService } from "../../_lib/service-data";
import { deleteServiceTemplateAction, updateServiceTemplateAction } from "../../actions";

export default async function Page({
  params,
}: {
  params: Promise<{
    serviceId: string;
  }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to edit services"
        description="Reusable service templates are private to each signed-in account."
      />
    );
  }

  const { serviceId } = await params;
  const service = await getService(currentUser.id, serviceId);

  if (!service) {
    notFound();
  }

  return (
    <ServiceWorkspace
      action={updateServiceTemplateAction}
      deleteAction={deleteServiceTemplateAction}
      mode="edit"
      service={service}
    />
  );
}
