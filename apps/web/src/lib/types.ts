export type User = { id: string; name: string; role: string };
export type Resource = {
  id: string;
  name: string;
  kind: string;
  capacity: number;
  description: string;
};
export type Reservation = {
  id: string;
  resource_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  expires_at: string;
  status: string;
  is_owner: boolean;
};
export type Activity = {
  id: string;
  type: string;
  created_at: string;
  title: string;
  resource_name: string;
  actor_name: string;
};
export type Notification = { event_id: string; type: string; title: string; created_at: string };
