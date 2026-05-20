import { Clock3, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { EmployeeLoginForm } from "./_components/employee-login-form";

export default function Page() {
  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.34),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(34,197,94,0.2),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0),rgba(15,23,42,0.88))]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3 text-sm text-white/80">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
              <Clock3 className="size-5" />
            </span>
            Employee Time Portal
          </div>
          <div className="grid gap-6">
            <div className="space-y-3">
              <h1 className="max-w-lg font-light text-5xl tracking-tight">Manage your time with confidence</h1>
              <p className="max-w-md text-lg text-white/70">
                View your weekly hours, add time for worked days, and keep your records current from any device.
              </p>
            </div>
          </div>
          <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-5">
            <div className="flex items-center gap-2 font-medium text-sm">
              <ShieldCheck className="size-4 text-emerald-300" />
              Secure employee lookup
            </div>
            <p className="text-sm text-white/65">Use the phone number on file and your 4-digit employee ID.</p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-3 text-center lg:text-left">
            <div className="space-y-2">
              <h1 className="font-semibold text-3xl tracking-tight">Employee Time Portal</h1>
              <p className="text-muted-foreground text-sm">
                Enter your phone number and employee ID to view and log your weekly hours.
              </p>
            </div>
          </div>
          <Card className="border-muted-foreground/15 shadow-sm">
            <CardHeader>
              <CardTitle>Verify your details</CardTitle>
              <CardDescription>Your phone number should match the number your manager has on file.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmployeeLoginForm />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
