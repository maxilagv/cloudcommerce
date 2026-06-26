import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Iniciar sesión · CloudCommerce",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cc-page" />}>
      <LoginForm />
    </Suspense>
  );
}
