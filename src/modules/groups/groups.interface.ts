export interface IGroup {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  inviteCode: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface IGroupWithMemberCount extends IGroup {
  memberCount: number;
}

export interface IGroupMember {
  groupId: string;
  userId: string;
  role: string;
  joinedAt: Date;
}

export interface ICreateGroup {
  id: string;
  name: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  inviteCode: string;
  createdBy: string;
}

export interface IGroupDetail extends IGroup {
  members: Array<{
    user_id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
    role: string;
    joined_at: Date;
  }>;
}
