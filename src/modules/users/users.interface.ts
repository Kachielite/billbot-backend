export interface IUser {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  currency: string;
  googleId: string | null;
  appleId: string | null;
  createdAt: Date;
}

export interface ICreateUser {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  googleId?: string | null;
  appleId?: string | null;
}

export interface IUpdateUser {
  name?: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  currency?: string;
  googleId?: string | null;
  appleId?: string | null;
}
