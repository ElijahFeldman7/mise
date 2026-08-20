"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMember, setMemberRole } from "@/lib/actions/household";
import { PersonIcon } from "@/components/Icons";

const AVATAR_TONES = [
  { background: "#e0c3b3", color: "#8a4527" },
  { background: "#bcd3ec", color: "#1f5a8f" },
  { background: "#c2d4b4", color: "#3f6b3f" },
  { background: "#e5d3a8", color: "#7a5f1f" },
];

export default function MemberRow({
  member,
  isYou,
  youAreOwner,
}: {
  member: {
    userId: string;
    role: "owner" | "member";
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  isYou: boolean;
  youAreOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const tone =
    AVATAR_TONES[
      Math.abs(member.userId.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) %
        AVATAR_TONES.length
    ];

  return (
    <div
      className="flex h-[62px] items-center gap-[14px] border-b border-rule"
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatarUrl} alt="" className="h-[38px] w-[38px] rounded-full object-cover" />
      ) : (
        <div
          className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={tone}
        >
          {member.name ? member.name.charAt(0).toUpperCase() : <PersonIcon size={17} />}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-medium -tracking-[0.01em]">
          {member.name}
          {isYou ? <span className="text-ink-faint"> · you</span> : null}
        </div>
        <div className="mt-[2px] truncate text-[11.5px] text-ink-faint">{member.email}</div>
      </div>

      {youAreOwner && !isYou ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await setMemberRole(member.userId, member.role === "owner" ? "member" : "owner");
                router.refresh();
              })
            }
            className="text-[11.5px]"
            style={{ color: member.role === "owner" ? "var(--accent)" : "var(--ink-faint)" }}
          >
            {member.role === "owner" ? "runs it" : "can edit"}
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await removeMember(member.userId);
                router.refresh();
              })
            }
            className="text-base leading-none text-ink-ghost"
            aria-label={`Remove ${member.name}`}
          >
            ×
          </button>
        </div>
      ) : (
        <span
          className="text-[11.5px]"
          style={{ color: member.role === "owner" ? "var(--accent)" : "var(--ink-faint)" }}
        >
          {member.role === "owner" ? "runs it" : "can edit"}
        </span>
      )}
    </div>
  );
}
