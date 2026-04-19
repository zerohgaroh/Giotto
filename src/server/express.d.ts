import type { StaffSession } from "../lib/staff-backend/types";

declare global {
  namespace Express {
    interface Request {
      staffSession?: StaffSession;
      guestTableId?: string;
    }
  }
}

export {};
