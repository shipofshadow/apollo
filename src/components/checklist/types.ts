import type { Service, ServiceVariation } from '../../types';

export type ServiceTypeCategory = 'headlights' | 'headunit';
export type InspectionPhaseMode = 'both' | 'before_only' | 'after_only';

export interface ChecklistWizardState {
  draftId: string;
  inspectionMode: InspectionPhaseMode;
  currentStep: number;

  customer: {
    name: string;
    email: string;
    phone?: string;
  };

  date: string;

  vehicle: {
    make: string;
    model: string;
    year: string;
    plateNumber: string;
  };

  service: {
    type: ServiceTypeCategory | null;

    serviceId: string | null;
    serviceName: string;

    variationId: string | null;
    variationName: string;

    isCustom: boolean;
    customName: string;
    customVariation: string;
  };

  technician: {
    id: string | null;
    name: string;
  };

  before: {
    itemResponses: Record<string, {
      checked: boolean;
      notes: string;
    }>;
    additionalNotes: string;
    confirmed: boolean;
    signature: string | null;
  };

  after: {
    itemResponses: Record<string, {
      checked: boolean;
      notes: string;
    }>;
    orientationResponses: Record<number, boolean>;
    confirmed: boolean;
    signature: string | null;
  };

  confirmed: boolean;
  signature: string | null;
}

export interface MappedServiceOption {
  id: string;
  name: string;
  category: ServiceTypeCategory;
  variations: ServiceVariation[];
  rawService: Service;
}
