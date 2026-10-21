import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Log in — IEU Labs",
  description: "Log in to IEU Labs to see your lab week and your lab place.",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
