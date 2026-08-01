import { redirect } from "next/navigation";

export default function IntegrationSetupPage() {
  redirect("/dashboard?view=connections");
}
