import type { UserRole } from '../generated/prisma/enums';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        role: UserRole;
      };
    }
  }
}

export {};
