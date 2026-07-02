import { AdminRole, type Actor } from "@cloudcommerce/types";

export type DashboardCapabilities = {
  canViewDashboard: boolean;
  canViewFinancial: boolean;
  canViewMargin: boolean;
  canViewOrders: boolean;
  canViewCatalog: boolean;
  canViewStock: boolean;
  canViewCustomerPii: boolean;
  canViewCustomerActivity: boolean;
  canViewAiActivity: boolean;
};

export const dashboardCapabilitiesFor = (actor: Actor): DashboardCapabilities => {
  if (actor.kind !== "admin") {
    return noDashboardCapabilities;
  }
  switch (actor.role) {
    case AdminRole.OWNER:
    case AdminRole.ADMIN:
      return {
        canViewDashboard: true,
        canViewFinancial: true,
        canViewMargin: true,
        canViewOrders: true,
        canViewCatalog: true,
        canViewStock: true,
        canViewCustomerPii: true,
        canViewCustomerActivity: true,
        canViewAiActivity: true,
      };
    case AdminRole.FINANCE:
      return {
        canViewDashboard: true,
        canViewFinancial: true,
        canViewMargin: true,
        canViewOrders: true,
        canViewCatalog: true,
        canViewStock: false,
        canViewCustomerPii: false,
        canViewCustomerActivity: false,
        canViewAiActivity: false,
      };
    case AdminRole.CATALOG_MANAGER:
      return {
        canViewDashboard: true,
        canViewFinancial: false,
        canViewMargin: false,
        canViewOrders: false,
        canViewCatalog: true,
        canViewStock: true,
        canViewCustomerPii: false,
        canViewCustomerActivity: false,
        canViewAiActivity: true,
      };
    case AdminRole.SUPPORT:
      return {
        canViewDashboard: true,
        canViewFinancial: false,
        canViewMargin: false,
        canViewOrders: true,
        canViewCatalog: true,
        canViewStock: false,
        canViewCustomerPii: false,
        canViewCustomerActivity: true,
        canViewAiActivity: false,
      };
  }
};

export const canViewDashboard = (actor: Actor): boolean => dashboardCapabilitiesFor(actor).canViewDashboard;

const noDashboardCapabilities: DashboardCapabilities = {
  canViewDashboard: false,
  canViewFinancial: false,
  canViewMargin: false,
  canViewOrders: false,
  canViewCatalog: false,
  canViewStock: false,
  canViewCustomerPii: false,
  canViewCustomerActivity: false,
  canViewAiActivity: false,
};
