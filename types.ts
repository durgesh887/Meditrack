
export interface Reminder {
  id: string;
  time: string; // HH:mm
  enabled: boolean;
}

export interface Medicine {
  id: string;
  name: string;
  expiryDate: string; // YYYY-MM-DD
  dosage: string;
  quantity: number;
  assignedTo: string;
  isVerified: boolean;
  reminders: Reminder[];
}

export interface FamilyMember {
  id: string;
  name: string;
}

export enum Screen {
  Welcome,
  Home,
  Inventory,
  AddMedicine,
  Reminders,
  Settings,
}

export type FilterType = 'all' | 'expiring' | 'low' | 'unverified';
