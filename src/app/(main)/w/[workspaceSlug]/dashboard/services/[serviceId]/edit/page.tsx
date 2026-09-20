import { notFound } from "next/navigation";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getPermittedDashboardAuthorization } from "@/lib/authorization";

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
  const authorization = await getPermittedDashboardAuthorization("services.manage");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Service management access required"
        description="You do not have permission to edit services in this workspace."
      />
    );
  }

  const { serviceId } = await params;
  const service = await getService(authorization.workspaceId, serviceId);

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
