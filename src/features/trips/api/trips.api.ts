import type { ApiClient } from "../../../shared/api/api-client";
import type {
  Activity,
  ActivityInput,
  CreateTrip,
  Invitation,
  InvitationPreview,
  InvitationResult,
  Lifecycle,
  Membership,
  Page,
  Plan,
  PlanPolicy,
  TravelMeta,
  TravelPlace,
  Trip,
} from "../types";

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
        name: string;
        description: string | null;
        public_description: string | null;
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
    members: (tripId: string, cursor?: string, signal?: AbortSignal) =>
      client.request<Page<Membership>>(
        `/trips/${id(tripId)}/members?limit=100${cursor ? `&cursor=${id(cursor)}` : ""}`,
        { signal },
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
    previewInvitation: (token: string, signal?: AbortSignal) =>
      client.request<InvitationPreview>("/invitations/preview", {
        method: "POST",
        body: { token },
        signal,
      }),
    respondInvitation: (
      token: string,
      action: "accept" | "decline",
      key: string,
    ) =>
      client.request<{ membership?: Membership }>(
        `/invitations/${action}`,
        write("POST", { token }, key),
      ),
    searchPlaces: (tripId: string, q: string, signal?: AbortSignal) =>
      client.requestWithMeta<TravelPlace[], TravelMeta>(
        `/travel/places?${new URLSearchParams({ trip_id: tripId, q: q.trim() })}`,
        { signal },
      ),
  };
}
