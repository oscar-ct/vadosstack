const MAIN_PLATFORM_ADMIN_EMAIL = "oscar.a.castro818@gmail.com";

export function isMainPlatformAdministrator(admin: boolean | undefined, email: string) {
  return Boolean(admin) && email.trim().toLowerCase() === MAIN_PLATFORM_ADMIN_EMAIL;
}

export function hasMainPlatformAdministrator(
  users: ReadonlyArray<Readonly<{ admin: boolean | undefined; email: string }>>,
) {
  return users.some((user) => isMainPlatformAdministrator(user.admin, user.email));
}
