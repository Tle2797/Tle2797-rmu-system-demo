import { getExecutiveDashboardStats } from "../services/executive-dashboard-stats";

export async function getExecDashboardStats() {
  return await getExecutiveDashboardStats();
}
