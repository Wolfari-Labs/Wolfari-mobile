import type { ApiClient } from "../../../shared/api/api-client";
import type {
  Activity,
  ActivityInput,
  CreateTrip,
  DressCode,
  DressCodeInput,
  Invitation,
  InvitationPreview,
  InvitationResult,
  Lifecycle,
  Membership,
  MembershipOperation,
  Page,
  PackingInput,
  PackingItem,
  Plan,
  PlanPolicy,
  PlanPolicySettings,
  TravelMeta,
  TravelPlace,
  PoiMeta,
  PoiPlace,
  PoiQuery,
  RouteMode,
  TravelRoute,
  TravelRouteMeta,
  SelectedLocation,
  Trip,
  Recommendation,
  RecommendationType,
  WeatherDay,
  WeatherMeta,
} from "../types";

const invitationBody = (secret: string) =>
  secret.startsWith("inv1_") ? { token: secret } : { code: secret };

export function createTripsApi(client: ApiClient) {
  const id = encodeURIComponent;
  const write = (
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    body: unknown,
    key: string,
  ) => ({ method, body, headers: { "Idempotency-Key": key } });
  return {
    list(lifecycle?: Lifecycle, cursor?: string, signal?: AbortSignal) {
      const query = new URLSearchParams({
        limit: "20",
        ...(lifecycle ? { lifecycle } : {}),
        ...(cursor ? { cursor } : {}),
      });
      return client.request<Page<Trip>>(`/trips?${query}`, { signal });
    },
    saveLocation: (tripId: string, input: { name: string; address: string | null; latitude: string | null; longitude: string | null; attribution: { text: string; url: string }[]; expected_plan_version: number }, key: string) =>
      client.request<SelectedLocation>(`/trips/${id(tripId)}/selected-locations`, write("POST", input, key)),
    removeLocation: (tripId: string, locationId: string, version: number, key: string) =>
      client.request<{ deleted: boolean }>(`/trips/${id(tripId)}/selected-locations/${id(locationId)}`, write("DELETE", { expected_plan_version: version }, key)),
    get: (tripId: string, signal?: AbortSignal) =>
      client.request<Trip>(`/trips/${id(tripId)}`, { signal }),
    create: (input: CreateTrip, key: string) =>
      client.request<Trip>(
        "/trips",
        write("POST", { ...input, client_request_id: key }, key),
      ),
    update: (
      trip: Trip,
      input: {
        name?: string;
        description?: string | null;
        public_description?: string | null;
        start_at?: string;
        end_at?: string;
        timezone?: string;
        budget_amount?: string | null;
      },
      key: string,
    ) =>
      client.request<Trip>(
        `/trips/${id(trip.id)}`,
        write(
          "PATCH",
          {
            ...input,
            expected_plan_version: trip.plan_version,
            expected_export_revision: trip.export_revision,
          },
          key,
        ),
      ),
    plan: (tripId: string, signal?: AbortSignal) =>
      client.request<Plan>(`/trips/${id(tripId)}/plan`, { signal }),
    uploadCover: (tripId: string, body: FormData) =>
      client.request<Trip>(`/trips/${id(tripId)}/cover`, { method: "POST", body }),
    removeCover: (tripId: string) =>
      client.request<Trip>(`/trips/${id(tripId)}/cover`, { method: "DELETE" }),
    cover: (tripId: string, signal?: AbortSignal) =>
      client.request<Blob>(`/trips/${id(tripId)}/cover`, { responseType: "blob", signal }),
    reorder: (
      tripId: string,
      activityIds: string[],
      version: number,
      key: string,
    ) =>
      client.request<{
        trip_id: string;
        plan_version: number;
        export_revision: number;
      }>(
        `/trips/${id(tripId)}/activities/order`,
        write(
          "PUT",
          { activity_ids: activityIds, expected_plan_version: version },
          key,
        ),
      ),
    saveActivity: (
      tripId: string,
      activityId: string | undefined,
      input: ActivityInput,
      key: string,
    ) =>
      client.request<Activity>(
        `/trips/${id(tripId)}/activities${activityId ? `/${id(activityId)}` : ""}`,
        write(activityId ? "PATCH" : "POST", input, key),
      ),
    complete: (
      tripId: string,
      activity: Activity,
      version: number,
      key: string,
    ) =>
      client.request<Activity>(
        `/trips/${id(tripId)}/activities/${id(activity.id)}/completion`,
        write(
          "PATCH",
          {
            expected_plan_version: version,
            status: activity.status === "TODO" ? "COMPLETED" : "TODO",
          },
          key,
        ),
      ),
    removeActivity: (
      tripId: string,
      activityId: string,
      version: number,
      key: string,
    ) =>
      client.request<{ plan_version: number }>(
        `/trips/${id(tripId)}/activities/${id(activityId)}`,
        write(
          "DELETE",
          { expected_plan_version: version, confirmed: true },
          key,
        ),
      ),
    saveDressCode: (
      tripId: string,
      dressCodeId: string | undefined,
      input: DressCodeInput,
      key: string,
    ) =>
      client.request<DressCode>(
        `/trips/${id(tripId)}/dress-codes${dressCodeId ? `/${id(dressCodeId)}` : ""}`,
        write(dressCodeId ? "PATCH" : "POST", input, key),
      ),
    uploadDressCodeImage: async (tripId: string, body: FormData) => {
      const row = await client.request<{ image_id: string; mime_type: string; size_bytes: number }>(`/trips/${id(tripId)}/dress-code-images`, { method: 'POST', body });
      if (!row || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.image_id) || row.mime_type !== 'image/jpeg' || !Number.isInteger(row.size_bytes) || row.size_bytes < 1 || row.size_bytes > 2 * 1024 * 1024) throw Error('Phản hồi tải ảnh không hợp lệ.');
      return row;
    },
    dressCodeImage: (tripId: string, dressCodeId: string, signal?: AbortSignal) => client.request<Blob>(`/trips/${id(tripId)}/dress-codes/${id(dressCodeId)}/reference-image`, { responseType: 'blob', signal }),
    removeDressCode: (
      tripId: string,
      dressCodeId: string,
      version: number,
      key: string,
    ) =>
      client.request<{ plan_version: number }>(
        `/trips/${id(tripId)}/dress-codes/${id(dressCodeId)}`,
        write("DELETE", { expected_plan_version: version }, key),
      ),
    members: (tripId: string, cursor?: string, signal?: AbortSignal, includeLeft = false) =>
      client.request<Page<Membership>>(
        `/trips/${id(tripId)}/members?limit=100${cursor ? `&cursor=${id(cursor)}` : ""}${includeLeft ? "&include_left=true" : ""}`,
        { signal },
      ),
    savePacking: (tripId: string, itemId: string | undefined, input: PackingInput, key: string) =>
      client.request<PackingItem>(`/trips/${id(tripId)}/packing-items${itemId ? `/${id(itemId)}` : ""}`, write(itemId ? "PATCH" : "POST", input, key)),
    removePacking: (tripId: string, itemId: string, version: number, key: string) =>
      client.request<{ plan_version: number }>(`/trips/${id(tripId)}/packing-items/${id(itemId)}`, write("DELETE", { expected_plan_version: version }, key)),
    completePacking: (tripId: string, item: PackingItem, version: number, key: string) =>
      client.request<PackingItem>(`/trips/${id(tripId)}/packing-items/${id(item.id)}/completion`, write("PATCH", { status: item.status === "COMPLETED" ? "TODO" : "COMPLETED", expected_plan_version: version }, key)),
    getPolicy: (tripId: string, signal?: AbortSignal) =>
      client.request<PlanPolicySettings>(`/trips/${id(tripId)}/plan-policy`, { signal }),
    leave: (trip: Trip, reason: string, key: string) => client.request<MembershipOperation>(
      `/trips/${id(trip.id)}/leave`, write("POST", { reason: reason.trim(), expected_membership_revision: trip.membership_revision }, key),
    ),
    removeMember: (trip: Trip, memberId: string, reason: string, key: string) => client.request<MembershipOperation>(
      `/trips/${id(trip.id)}/members/${id(memberId)}`, write("DELETE", { reason: reason.trim(), expected_membership_revision: trip.membership_revision }, key),
    ),
    operation: (operationId: string, signal?: AbortSignal) => client.request<MembershipOperation>(`/operations/${id(operationId)}`, { signal }),
    inviteLink: (trip: Trip, key: string) => client.request<InvitationResult>(
      `/trips/${id(trip.id)}/invitations`, write("POST", { invitation_type: "LINK", expected_membership_revision: trip.membership_revision }, key),
    ),
    policy: (
      trip: Trip,
      policy: PlanPolicy,
      editor_member_ids: string[],
      key: string,
    ) =>
      client.request<{
        policy: PlanPolicy;
        editor_member_ids: string[];
        membership_revision: number;
      }>(
        `/trips/${id(trip.id)}/plan-policy`,
        write(
          "PUT",
          {
            policy,
            editor_member_ids,
            expected_membership_revision: trip.membership_revision,
          },
          key,
        ),
      ),
    invitations: (tripId: string, cursor?: string, signal?: AbortSignal) =>
      client.request<Page<Invitation>>(
        `/trips/${id(tripId)}/invitations?limit=100${cursor ? `&cursor=${id(cursor)}` : ""}`,
        { signal },
      ),
    invite: (trip: Trip, email: string, key: string) =>
      client.request<InvitationResult>(
        `/trips/${id(trip.id)}/invitations`,
        write(
          "POST",
          {
            invitation_type: "EMAIL",
            email: email.trim().toLowerCase(),
            expected_membership_revision: trip.membership_revision,
          },
          key,
        ),
      ),
    manageInvitation: (
      tripId: string,
      invitation: Invitation,
      action: "resend" | "revoke",
      key: string,
    ) =>
      client.request<InvitationResult>(
        `/trips/${id(tripId)}/invitations/${id(invitation.id)}/${action}`,
        write("POST", { expected_version: invitation.version }, key),
      ),
    /** `secret` is a short join code (XXXX-XXXX) or a legacy inv1_ link token. */
    previewInvitation: (secret: string, signal?: AbortSignal) =>
      client.request<InvitationPreview>("/invitations/preview", {
        method: "POST",
        body: invitationBody(secret),
        signal,
      }),
    respondInvitation: (
      secret: string,
      action: "accept" | "decline",
      key: string,
    ) =>
      client.request<{ membership?: Membership }>(
        `/invitations/${action}`,
        write("POST", invitationBody(secret), key),
      ),
    /** Map search: by text, around a point, or inside the visible map frame (bbox). */
    poiSearch: (tripId: string, query: PoiQuery, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
      return client.requestWithMeta<PoiPlace[], PoiMeta>(`/trips/${id(tripId)}/places/search?${params}`, { signal });
    },
    /** Saves a search result by its server-issued token; the server fills name, coordinates and attribution. */
    saveLocationToken: (tripId: string, input: { selection_token: string; expected_plan_version: number }, key: string) =>
      client.request<SelectedLocation>(`/trips/${id(tripId)}/selected-locations`, write("POST", input, key)),
    route: (coordinates: { latitude: number; longitude: number }[], mode: RouteMode, signal?: AbortSignal) =>
      client.requestWithMeta<TravelRoute, TravelRouteMeta>("/travel/route", { method: "POST", body: { coordinates, mode }, signal }),
    /** Daily forecast; data is null outside the 16-day window (meta.warnings FORECAST_OUT_OF_RANGE). */
    weather: (point: { latitude: number; longitude: number }, date: string, signal?: AbortSignal) =>
      client.requestWithMeta<WeatherDay | null, WeatherMeta>(
        `/travel/weather?${new URLSearchParams({ latitude: String(point.latitude), longitude: String(point.longitude), date })}`,
        { signal },
      ),
    /** Stores a preview on the server; nothing in the Plan changes until apply. */
    previewRecommendation: (tripId: string, input: { type: RecommendationType; date?: string; activity_ids?: string[] }, signal?: AbortSignal) =>
      client.request<Recommendation>(`/trips/${id(tripId)}/recommendations`, { method: "POST", body: input, signal }),
    applyRecommendation: (recommendationId: string, input: { item_ids: string[]; expected_plan_version: number }, key: string) =>
      client.request<Recommendation>(`/recommendations/${id(recommendationId)}/apply`, write("POST", input, key)),
    ignoreRecommendation: (recommendationId: string) =>
      client.request<Recommendation>(`/recommendations/${id(recommendationId)}/ignore`, { method: "POST", body: {} }),
    searchPlaces: (tripId: string, q: string, signal?: AbortSignal) =>
      client.requestWithMeta<TravelPlace[], TravelMeta>(
        `/travel/places?${new URLSearchParams({ trip_id: tripId, q: q.trim() })}`,
        { signal },
      ),
  };
}
