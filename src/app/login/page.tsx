import { PageShell } from "@/components/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";

// Тексти інтерфейсу — англійською (вимога PM); цих двох повідомлень у вимогах немає, формулювання розробника.
const ERRORS: Record<string, string> = {
  missing: "Enter your email and password",
  invalid: "Wrong email or password",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <PageShell narrow>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form action={login} className="flex flex-col gap-4">
        {message ? (
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit">Sign in</Button>
      </form>
    </PageShell>
  );
}
