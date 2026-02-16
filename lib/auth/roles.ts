export type UserRole = "admin" | "manager" | "staff";

export function parseUserRole(value: unknown): UserRole | null {
  if (value === "admin" || value === "manager" || value === "staff") {
    return value;
  }
  return null;
}
