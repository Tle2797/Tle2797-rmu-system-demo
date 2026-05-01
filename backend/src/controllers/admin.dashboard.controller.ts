import { getDashboardStats } from "../services/dashboard-stats";

export async function getAdminDashboardStats() {
  return await getDashboardStats();
}
