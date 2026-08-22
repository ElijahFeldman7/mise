import SignInButton from "./SignInButton";

export const metadata = { title: "mise" };

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; join?: string }>;
}) {
  const { next, error, join } = await searchParams;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-8">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0 35px, var(--rule) 35px 36px)",
        }}
      />
      <div aria-hidden className="absolute inset-y-0 left-14 w-px bg-margin-line" />

      <div className="relative flex w-full flex-col items-center">
        <h1 className="font-hand text-[80px] font-bold leading-[0.95] text-accent">mise</h1>
        <p className="mt-3 text-center text-[15px] leading-relaxed text-ink-soft text-pretty">
          Plan the week, write the list,
          <br />
          cross it off at the store.
        </p>

        <SignInButton next={next} join={join} />

        {error ? (
          <p className="mt-5 text-center text-xs text-accent">
            That didn&apos;t work: {error}
          </p>
        ) : null}

        <p className="mt-5 text-center text-xs leading-relaxed text-ink-faint">
          Signing in makes your notebook.
          <br />
          Invite the rest of the house after.
        </p>
      </div>
    </main>
  );
}
