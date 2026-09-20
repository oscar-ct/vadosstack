INSERT INTO "workspace_roles" (
  "id",
  "workspaceId",
  "name",
  "description",
  "systemKey",
  "isProtected",
  "createdAt",
  "updatedAt"
)
SELECT
  'role-' || md5(workspace."id" || 'ADMIN'),
  workspace."id",
  'Admin',
  'Full administrative access without workspace ownership.',
  'ADMIN',
  true,
  NOW(),
  NOW()
FROM "workspaces" workspace
ON CONFLICT ("workspaceId", "systemKey") DO NOTHING;

WITH all_permissions(permission_key) AS (
  SELECT unnest(ARRAY[
    'dashboard.overview.view', 'dashboard.performance.view',
    'calendar.view', 'calendar.manage',
    'leads.view', 'leads.create', 'leads.update', 'leads.delete',
    'customers.view', 'customers.create', 'customers.update', 'customers.delete',
    'estimates.view', 'estimates.create', 'estimates.update', 'estimates.delete', 'estimates.send', 'estimates.convert',
    'jobs.view', 'jobs.create', 'jobs.update', 'jobs.delete', 'jobs.complete',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.delete', 'invoices.send', 'invoices.record_payment',
    'services.view', 'services.manage',
    'employees.view', 'employees.manage', 'employees.compensation.view', 'employees.compensation.manage',
    'time.view', 'time.manage', 'time.approve', 'time.lock',
    'commerce.performance.view', 'orders.view', 'orders.create', 'orders.update', 'orders.delete', 'orders.returns.manage',
    'inventory.view', 'inventory.manage',
    'email.send', 'email.history.view', 'email.templates.manage', 'email.account.manage',
    'settings.view', 'settings.manage', 'settings.branding.manage', 'roles.manage', 'reports.export'
  ]::text[])
)
INSERT INTO "workspace_role_permissions" ("roleId", "permissionKey", "createdAt")
SELECT role."id", permission.permission_key, NOW()
FROM "workspace_roles" role
CROSS JOIN all_permissions permission
WHERE role."systemKey" = 'ADMIN'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;
