export type AlertSeverity = "info" | "warning" | "danger";

// types/accessibility.ts

export type AlertStatus = "pending" | "verified" | "resolved";

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;

  // optionnel
  buildingCode?: string;
  coord?: [number, number];
  imageUrl?: string;
  source?: "system" | "user";
}



/* -------------------------------------------------------------------------- */
/*                               CAMPUS EVENTS                                */
/* -------------------------------------------------------------------------- */

export type CrowdLevel = "low" | "medium" | "high";

export type CampusEvent = {
  id: string;

  title: string;
  description?: string;

  startsAt: string;
  endsAt?: string;

  /** Ex: UCU, STM, AWT */
  buildingCode?: string;
  buildingName?: string;

  floor?: number;

  impactsAccessibility: boolean;

  expectedCrowdLevel?: CrowdLevel;

  impactDescription?: string;
};
