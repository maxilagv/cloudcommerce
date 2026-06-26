import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Crear cuenta · CloudCommerce",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cc-page" />}>
      <RegisterForm />
    </Suspense>
  );
}
