export interface IPool {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  status: string;
  splitType: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface IPoolMember {
  poolId: string;
  userId: string;
  joinedAt: Date;
}
