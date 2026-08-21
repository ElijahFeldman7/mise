export default function SignInButton({ next }: { next?: string }) {
  const href = next ? `/auth/signin?next=${encodeURIComponent(next)}` : "/auth/signin";

  return (
    <a
      href={href}
      className="mt-11 flex w-full max-w-[300px] items-center justify-center gap-3 rounded-[3px] bg-ink text-[15.5px] font-medium text-white"
      style={{ height: 58 }}
    >
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white">
        <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
        <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z" />
        <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8 41.1 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C2.9 17.3 2 20.5 2 24s.9 6.7 2.5 9.9l7.3-5.7z" />
        <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 8 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
        </svg>
      </span>
      <span>Continue with Google</span>
    </a>
  );
}
