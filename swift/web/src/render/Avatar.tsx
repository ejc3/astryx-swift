import { Avatar, AvatarStatusDot } from "@astryxdesign/core/Avatar";
import type { Tone } from "@astryx-native/core";

type Size = "sm" | "md" | "lg";

/**
 * Astryx's Avatar with the core's initials and hue. Astryx would derive initials from a name;
 * the core has already decided them, so they are passed as separate "words" and kept.
 */
export function PersonAvatar({ initials, hue, name, size = "md", status, statusLabel }: { initials: string; hue: number; name?: string; size?: Size; status?: Tone; statusLabel?: string }) {
  const dot = status === "success" ? "success" : status === "danger" ? "error" : status ? "neutral" : null;
  return (
    <Avatar
      name={[...initials].join(" ")}
      alt={name ?? initials}
      tooltip={name ?? false}
      size={size}
      className="an-avatar"
      style={{ ["--an-hue" as string]: hue }}
      {...(dot ? { status: <AvatarStatusDot variant={dot} label={statusLabel ?? ""} /> } : {})}
    />
  );
}
