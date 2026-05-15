import { DraftCampaign, DraftAdSet, DraftAd } from '@prisma/client';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export class DraftValidationEngine {
  static async validateCampaign(campaign: DraftCampaign): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const data = campaign.data as any;

    if (!campaign.name) {
      errors.push({ field: 'name', message: 'Campaign name is required', severity: 'error' });
    }

    if (!campaign.objective && !data.objective) {
      errors.push({ field: 'objective', message: 'Objective is required', severity: 'error' });
    }

    // Add more validation rules as needed
    return errors;
  }

  static async validateAdSet(adSet: DraftAdSet, campaignObjective?: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const data = adSet.data as any;

    if (!adSet.name) {
      errors.push({ field: 'name', message: 'Ad Set name is required', severity: 'error' });
    }

    if (!data.billing_event) {
      errors.push({ field: 'billing_event', message: 'Billing event is required', severity: 'error' });
    }

    if (!data.optimization_goal) {
      errors.push({ field: 'optimization_goal', message: 'Optimization goal is required', severity: 'error' });
    }

    if (!data.targeting) {
      errors.push({ field: 'targeting', message: 'Targeting is required', severity: 'error' });
    }

    // promoted_object requirements per objective
    if (campaignObjective === 'OUTCOME_SALES' || campaignObjective === 'OUTCOME_APP_PROMOTION') {
      if (!data.promoted_object) {
        const required = campaignObjective === 'OUTCOME_SALES' ? 'pixel_id' : 'application_id';
        errors.push({
          field: 'promoted_object',
          message: `promoted_object with ${required} is required for ${campaignObjective}`,
          severity: 'error',
        });
      } else if (campaignObjective === 'OUTCOME_SALES' && !data.promoted_object.pixel_id) {
        errors.push({ field: 'promoted_object.pixel_id', message: 'pixel_id is required for OUTCOME_SALES', severity: 'error' });
      } else if (campaignObjective === 'OUTCOME_APP_PROMOTION' && !data.promoted_object.application_id) {
        errors.push({ field: 'promoted_object.application_id', message: 'application_id is required for OUTCOME_APP_PROMOTION', severity: 'error' });
      }
    }

    return errors;
  }

  static async validateAd(ad: DraftAd): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const data = ad.data as any;

    if (!ad.name) {
      errors.push({ field: 'name', message: 'Ad name is required', severity: 'error' });
    }

    if (!data.creative) {
      errors.push({ field: 'creative', message: 'Creative is required', severity: 'error' });
    }

    return errors;
  }

  static async validateFullDraft(campaign: any): Promise<{
    campaignErrors: ValidationError[];
    adSetErrors: Record<string, ValidationError[]>;
    adErrors: Record<string, ValidationError[]>;
    isValid: boolean;
  }> {
    const campaignErrors = await this.validateCampaign(campaign);
    const adSetErrors: Record<string, ValidationError[]> = {};
    const adErrors: Record<string, ValidationError[]> = {};

    let isValid = campaignErrors.every(e => e.severity !== 'error');

    if (campaign.adSets) {
      const campaignObjective = (campaign.data as any)?.objective || campaign.objective;
      for (const adSet of campaign.adSets) {
        const errors = await this.validateAdSet(adSet, campaignObjective);
        adSetErrors[adSet.id] = errors;
        if (errors.some(e => e.severity === 'error')) isValid = false;

        if (adSet.ads) {
          for (const ad of adSet.ads) {
            const errors = await this.validateAd(ad);
            adErrors[ad.id] = errors;
            if (errors.some(e => e.severity === 'error')) isValid = false;
          }
        }
      }
    }

    return { campaignErrors, adSetErrors, adErrors, isValid };
  }
}
