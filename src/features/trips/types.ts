export type Page<T> = { items: T[]; next_cursor: string | null };
export type Lifecycle = "UPCOMING" | "ONGOING" | "COMPLETED" | "ARCHIVED";
export type PlanPolicy = "OWNER_ONLY" | "SELECTED_MEMBERS" | "ALL_MEMBERS";
export type Membership = { id: string; trip_id: string; user_id: string; role: "OWNER" | "MEMBER"; joined_at: string; left_at: string | null };
export type Trip = {
  id: string; name: string; description: string | null; public_description: string | null;
  start_at: string; end_at: string; timezone: string; lifecycle: Lifecycle; archived_at: string | null;
  plan_edit_policy: PlanPolicy; plan_version: number; membership_revision: number; export_revision: number;
  current_membership: Membership; permissions: { can_read: boolean; can_update: boolean };
};
export type CreateTrip = { name: string; description?: string; start_at: string; end_at: string; timezone: string };
export type Activity = {
  id: string; trip_id: string; title: string; description: string | null; public_description: string | null;
  activity_type: string; selected_location_id: string | null; starts_at: string | null; ends_at: string | null;
  position: number; status: "TODO" | "COMPLETED"; source: string; plan_version: number;
};
export type ActivityInput = { title: string; activity_type: string; description?: string | null; starts_at?: string | null; ends_at?: string | null; selected_location_id?: string | null; position: number; expected_plan_version: number };
export type SelectedLocation = { id: string; name: string; address: string | null; latitude: string | null; longitude: string | null; source: string };
export type PackingItem = { id: string; name: string; quantity: string; unit: string | null; note: string | null; category: string | null; assigned_member_id: string | null; due_at: string | null; status: "TODO" | "COMPLETED" };
export type DressCode = { id: string; scope_type: "TRIP" | "DAY" | "ACTIVITY"; plan_date: string | null; activity_id: string | null; label: string; description: string | null };
export type Plan = { trip_id: string; plan_version: number; export_revision: number; activities: Activity[]; selected_locations: SelectedLocation[]; dress_codes: DressCode[]; packing_items: PackingItem[]; permissions: { can_read: boolean; can_edit: boolean; can_complete: boolean } };
export type Invitation = { id: string; trip_id: string; invitation_type: "EMAIL" | "LINK"; email: string | null; status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED"; version: number; expires_at: string; resolved_at: string | null };
export type InvitationResult = { invitation: Invitation; one_time_link?: string };
export type InvitationPreview = { id: string; trip_name: string; inviter_display_name: string; status: Invitation["status"]; expires_at: string };
export type TravelPlace = { id: string; name: string; address: string; coordinates: { latitude: number; longitude: number }; opening_hours: { weekday: number; opens_at: string; closes_at: string }[] };
export type TravelMeta = { status: "SUCCESS" | "NO_RESULT" | "ERROR"; provider: string; fetched_at: string; stale: boolean; is_mock: boolean; warnings: string[]; attribution: { text: string; url: string }[] };
