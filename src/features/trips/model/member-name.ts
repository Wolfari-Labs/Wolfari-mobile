import type { Membership } from "../types";

// Prefer the server-provided display name; fall back to a short, stable tag.
export function memberName(member: Pick<Membership, "user_id" | "display_name">, selfUserId?: string) {
  if (selfUserId && member.user_id === selfUserId) return "Tôi";
  return member.display_name?.trim() || `Bạn đồng hành #${member.user_id.slice(0, 4).toUpperCase()}`;
}

/** Resolve a user id to a readable name using the trip member list ("Bạn" for the viewer). */
export function userNamer(members: readonly Pick<Membership, "user_id" | "display_name">[] | undefined, selfUserId: string) {
  return (userId: string) => {
    if (userId === selfUserId) return "Bạn";
    const member = members?.find(m => m.user_id === userId);
    return member ? memberName(member) : `Bạn đồng hành #${userId.slice(0, 4).toUpperCase()}`;
  };
}
