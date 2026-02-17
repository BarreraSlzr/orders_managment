import LoginForm from "./LoginForm";

export default function LoginPage() {
  const defaultTenant = process.env.TENANT_DEFAULT || "";
  return <LoginForm defaultTenant={defaultTenant || undefined} />;
}
