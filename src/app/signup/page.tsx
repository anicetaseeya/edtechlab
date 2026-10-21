import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign up — IEU Labs",
  description:
    "Create your IEU Labs account with an email and a password, and go straight to your lab week.",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
