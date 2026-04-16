export interface IActivity {
  id: string;
  actorId: string | null;
  poolId: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface IActivityEnriched {
  id: string;
  type: string;
  actor: { id: string; name: string; avatar_url: string | null } | null;
  pool: { id: string; name: string } | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}
