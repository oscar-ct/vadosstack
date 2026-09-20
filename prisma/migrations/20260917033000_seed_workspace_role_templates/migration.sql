WITH role_templates(system_key, name, description) AS (
  VALUES
    ('MANAGER', 'Manager', 'Runs daily operations without access to roles, connected email, or company ownership settings.'),
    ('OFFICE_STAFF', 'Office staff', 'Manages customers, scheduling, estimates, jobs, invoices, and outbound email.'),
    ('TIME_MANAGER', 'Time manager', 'Manages employee records and time without compensation or broader business access.'),
    ('READ_ONLY', 'Read only', 'Can view business records but cannot change or send them.')
)
INSERT INTO "workspace_roles" ("id", "workspaceId", "name", "description", "systemKey", "isProtected", "createdAt", "updatedAt")
SELECT
  'role-' || md5(workspace."id" || template.system_key),
  workspace."id",
  template.name,
  template.description,
  template.system_key,
  true,
  NOW(),
  NOW()
FROM "workspaces" workspace
CROSS JOIN role_templates template
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
WHERE role."systemKey" = 'MANAGER'
  AND permission.permission_key NOT IN ('roles.manage', 'email.account.manage', 'settings.branding.manage')
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

WITH office_permissions(permission_key) AS (
  SELECT unnest(ARRAY[
    'dashboard.overview.view', 'dashboard.performance.view',
    'calendar.view', 'calendar.manage',
    'leads.view', 'leads.create', 'leads.update', 'leads.delete',
    'customers.view', 'customers.create', 'customers.update', 'customers.delete',
    'estimates.view', 'estimates.create', 'estimates.update', 'estimates.delete', 'estimates.send', 'estimates.convert',
    'jobs.view', 'jobs.create', 'jobs.update', 'jobs.delete', 'jobs.complete',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.delete', 'invoices.send', 'invoices.record_payment',
    'services.view', 'employees.view', 'time.view',
    'email.send', 'email.history.view', 'reports.export'
  ]::text[])
)
INSERT INTO "workspace_role_permissions" ("roleId", "permissionKey", "createdAt")
SELECT role."id", permission.permission_key, NOW()
FROM "workspace_roles" role
CROSS JOIN office_permissions permission
WHERE role."systemKey" = 'OFFICE_STAFF'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

WITH time_permissions(permission_key) AS (
  SELECT unnest(ARRAY[
    'employees.view', 'employees.manage', 'time.view', 'time.manage', 'time.approve', 'time.lock'
  ]::text[])
)
INSERT INTO "workspace_role_permissions" ("roleId", "permissionKey", "createdAt")
SELECT role."id", permission.permission_key, NOW()
FROM "workspace_roles" role
CROSS JOIN time_permissions permission
WHERE role."systemKey" = 'TIME_MANAGER'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

WITH read_permissions(permission_key) AS (
  SELECT unnest(ARRAY[
    'dashboard.overview.view', 'dashboard.performance.view', 'calendar.view',
    'leads.view', 'customers.view', 'estimates.view', 'jobs.view', 'invoices.view', 'services.view',
    'employees.view', 'time.view', 'commerce.performance.view', 'orders.view', 'inventory.view', 'email.history.view'
  ]::text[])
)
INSERT INTO "workspace_role_permissions" ("roleId", "permissionKey", "createdAt")
SELECT role."id", permission.permission_key, NOW()
FROM "workspace_roles" role
CROSS JOIN read_permissions permission
WHERE role."systemKey" = 'READ_ONLY'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;
