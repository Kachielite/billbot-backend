export interface ISession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IAuthResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
    created_at: Date;
  };
  isNewUser: boolean;
}

export interface IGoogleAuthPayload {
  idToken: string;
}

export interface IAppleAuthPayload {
  identityToken: string;
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
  } | null;
  email?: string | null;
}
