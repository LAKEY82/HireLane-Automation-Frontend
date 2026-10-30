import { LoginForm } from "@/components/login-form";
import { APP_NAME, Logo, TAGLINE } from "@/components/brand";
import { CheckIcon } from "@/components/icons";
import { googleEnabled, microsoftEnabled } from "@/auth";
import { SIGN_IN_ERRORS } from "@/lib/session";

export const metadata = { title: "Sign in" };

const POINTS = [
  "Reads applications straight from your Gmail or company inbox",
  "AI pulls out skills and experience, and sorts every CV",
  "Kind, personal rejection emails in one click",
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, detail } = await searchParams;
  const message = typeof error === "string" ? (SIGN_IN_ERRORS[error] ?? "Sign-in failed. Please try again.") : null;

  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative"><Logo inverted /></div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">{TAGLINE}</h2>
          <ul className="mt-8 grid gap-4">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-brand-100">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15"><CheckIcon className="h-3.5 w-3.5 text-white" /></span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-brand-200/70">© {new Date().getFullYear()} {APP_NAME}</p>
      </section>

      <section className="flex items-center justify-center bg-white px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden"><Logo /></div>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900 lg:mt-0">Welcome back</h1>
          <p className="mb-8 mt-1 text-sm text-slate-500">Sign in with the mailbox that receives your applications.</p>
          {message && (
            <p role="alert" className="mb-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {message}
              {typeof detail === "string" && <span className="mt-1 block text-xs text-rose-600">{detail}</span>}
            </p>
          )}
          <LoginForm next={typeof next === "string" ? next : "/"} google={googleEnabled()} microsoft={microsoftEnabled()} />
        </div>
      </section>
    </main>
  );
}
