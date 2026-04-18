import { getRestaurantData } from "./restaurant";
import type { StaffBootstrap, StaffSession } from "./types";

export async function getStaffBootstrap(session: StaffSession): Promise<StaffBootstrap> {
  return {
    session,
    restaurant: await getRestaurantData(),
  };
}
