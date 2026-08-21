export default function Heading({
  children,
  color = "var(--accent)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <h2
      className="inline-block pb-[3px] text-sm font-semibold -tracking-[0.01em]"
      style={{ borderBottom: `2px solid ${color}` }}
    >
      {children}
    </h2>
  );
}
