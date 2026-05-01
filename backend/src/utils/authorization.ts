import type { JwtUser, UserRole } from "./auth";

export function hasAnyRole(user: JwtUser, roles: UserRole[]) {
  return roles.includes(user.role);
}

export function isDepartmentScopedRole(user: JwtUser) {
  return user.role === "dept_head" || user.role === "staff";
}

export function canAccessDepartment(user: JwtUser, departmentId: number) {
  if (user.role === "admin") return true;

  if (isDepartmentScopedRole(user)) {
    return user.departmentId === departmentId;
  }

  return false;
}

export function canManageDepartmentQuestion(user: JwtUser, departmentId: number) {
  return canAccessDepartment(user, departmentId);
}
