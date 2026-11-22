export type Page<T> = { items: T[]; next_cursor: string | null };
export type MembershipOperation = {
  operation_id: string; trip_id: string;
  state: "PROCESSING" | "PENDING_RECOVERY" | "SUCCEEDED" | "FAILED" | "NEEDS_REVIEW";
  outcome?: { status: "COMMITTED" | "REJECTED" | "CANCELLED"; error_code?: string };
  error_code?: string; next_retry_at?: string;
};
export type Lifecycle = "UPCOMING" | "ONGOING" | "COMPLETED" | "ARCHIVED";
export type PlanPolicy = "OWNER_ONLY" | "SELECTED_MEMBERS" | "ALL_MEMBERS";
export type PlanPolicySettings = { policy: PlanPolicy; editor_member_ids: string[]; membership_revision: number };
export type Membership = { id: string; trip_id: string; user_id: string; role: "OWNER" | "MEMBER"; joined_at: string; left_at: string | null; display_name?: string | null };
export type Trip = {
  id: string; name: string; description: string | null; public_description: string | null;
  start_at: string; end_at: string; timezone: string; lifecycle: Lifecycle; archived_at: string | null;
  plan_edit_policy: PlanPolicy; plan_version: number; membership_revision: number; export_revision: number;
  current_membership: Membership; permissions: { can_read: boolean; can_update: boolean; can_invite?: boolean };
  /** Planned VND budget (integer string); null when not set. Older servers omit it. */
  budget_amount?: string | null;
  /** True when a cover image is stored; fetch it from GET /trips/:id/cover. */
  cover_image_available?: boolean;
};
export type CreateTrip = { name: string; description?: string; start_at: string; end_at: string; timezone: string; budget_amount?: string };
export type Activity = {
  id: string; trip_id: string; title: string; description: string | null; public_description: string | null;
  activity_type: string; selected_location_id: string | null; starts_at: string | null; ends_at: string | null;
  /** Calendar day (YYYY-MM-DD in Trip.timezone) for a day-only activity; null when timed or unscheduled. */
  scheduled_date?: string | null;
  position: number; status: "TODO" | "COMPLETED"; source: string; plan_version: number;
};
export type ActivityInput = { title: string; activity_type: string; description?: string | null; public_description?: string | null; starts_at?: string | null; ends_at?: string | null; scheduled_date?: string | null; selected_location_id?: string | null; position: number; expected_plan_version: number };
export type SelectedLocation = { id: string; name: string; address: string | null; latitude: string | null; longitude: string | null; source: string; metadata?: { attribution?: { text: string; url: string }[] } };
export type PackingItem = { id: string; name: string; quantity: string; unit: string | null; note: string | null; category: string | null; assigned_member_id: string | null; due_at: string | null; status: "TODO" | "COMPLETED"; completed_by_user_id?: string | null; plan_version?: number };
export type PackingInput = Pick<PackingItem, "name" | "quantity" | "unit" | "note" | "category" | "assigned_member_id" | "due_at"> & { expected_plan_version: number };
export type DressCode = { id: string; scope_type: "TRIP" | "DAY" | "ACTIVITY"; plan_date: string | null; activity_id: string | null; label: string; description: string | null; plan_version?: number; reference_image_available?: boolean };
/** API051/052 body. PATCH keeps omitted fields, so public_description is never sent from mobile. */
export type DressCodeInput = { scope_type: DressCode["scope_type"]; plan_date: string | null; activity_id: string | null; label: string; description: string | null; expected_plan_version: number; reference_image_id?: string | null };
export type Plan = { trip_id: string; plan_version: number; export_revision: number; activities: Activity[]; selected_locations: SelectedLocation[]; dress_codes: DressCode[]; packing_items: PackingItem[]; permissions: { can_read: boolean; can_edit: boolean; can_complete: boolean };
  /** Writers this server offers beyond activities; absent on older backends. */
  capabilities?: { dress_codes_write?: boolean; dress_code_images_write?: boolean; packing_write?: boolean; locations_write?: boolean } };
export type Invitation = { id: string; trip_id: string; invitation_type: "EMAIL" | "LINK"; email: string | null; status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED"; version: number; expires_at: string; resolved_at: string | null; code_hint?: string | null; invited_by_user_id?: string | null };
/** join_code (XXXX-XXXX) is returned once, at creation, for link invitations. */
export type InvitationResult = { invitation: Invitation; one_time_link?: string; join_code?: string };
export type InvitationPreview = { id: string; trip_name: string; inviter_display_name: string; status: Invitation["status"]; expires_at: string };
export type TravelPlace = { id: string; name: string; address: string; coordinates: { latitude: number; longitude: number }; opening_hours: { weekday: number; opens_at: string; closes_at: string }[] };
export type TravelMeta = { status: "SUCCESS" | "NO_RESULT" | "ERROR"; provider: string; fetched_at: string; stale: boolean; is_mock: boolean; warnings: string[]; attribution: { text: string; url: string }[] };

/** POI search (GET /trips/{id}/places/search): curated Wolfari data, optionally Geoapify. */
export type PoiPlace = {
  id: string; name: string; address?: string; coordinates: { latitude: number; longitude: number };
  selection_token: string; attribution: string; provider: "WOLFARI" | "GEOAPIFY";
  category: string; category_label: string; tier: 1 | 2 | 3 | 9; coord_verified: boolean;
  typical_duration_min?: number; activity_type: string; dress_code_hint: string;
  province_name?: string | null;
  /** Search group of `category` (tourism, restaurant, cafe…); null when unknown. */
  category_group?: string | null;
  /** Licensed photo stored by Wolfari (POI-IMAGES); null/absent when none. */
  hero_image?: PoiImage | null;
};
/** Gateway-relative WebP URLs and the credit line that must be shown with the photo. */
export type PoiImage = {
  url: string; thumbnail_url: string; small_url: string; width: number | null; height: number | null;
  author: string | null; license: string; license_url: string | null; source_url: string; attribution: string;
};
export type PoiMeta = {
  provider: string; status: "SUCCESS" | "NO_RESULT" | "ERROR"; stale: boolean; is_mock: boolean;
  fetched_at?: string | null; warnings?: string[]; bbox_truncated?: boolean;
};
export type PoiCategory = "tourism" | "restaurant" | "cafe" | "accommodation" | "nightlife" | "shopping" | "entertainment" | "wellness" | "transport" | "services" | "other" | "all";
export type PoiQuery = { q?: string; latitude?: number; longitude?: number; radius_m?: number; category?: PoiCategory; bbox?: string; limit?: number };
export type RouteMode = "DRIVING" | "WALKING";
export type TravelRoute = { distance_m: number; duration_seconds: number; geometry: { latitude: number; longitude: number }[] } | null;
export type TravelRouteMeta = { status: "SUCCESS" | "NO_RESULT"; provider: string; stale: boolean; warnings: string[] };
