import { format } from 'date-fns';

export interface NamingContext {
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  date?: Date;
  budget?: string | number;
  country?: string;
  placement?: string;
  objective?: string;
  iteration_number?: number;
  custom_text?: string;
  angle?: string;
  ad_account_name?: string;
}

export class NamingEngine {
  static parse(pattern: string, context: NamingContext): string {
    let result = pattern;

    const variables: Record<string, string | undefined> = {
      campaign_name: context.campaign_name,
      adset_name: context.adset_name,
      ad_name: context.ad_name,
      date: context.date ? format(context.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      time: context.date ? format(context.date, 'HH:mm') : format(new Date(), 'HH:mm'),
      budget: context.budget?.toString(),
      country: context.country || 'TH',
      placement: context.placement || 'All_Placements',
      objective: context.objective || 'SALES',
      iteration_number: context.iteration_number?.toString(),
      custom_text: context.custom_text,
      angle: context.angle || 'UGC',
      ad_account_name: context.ad_account_name
    };

    // 1. Basic replacement with transformation support
    // Pattern: {{variable|transform}}
    const regex = /\{\{(.*?)\}\}/g;
    result = result.replace(regex, (match, p1) => {
      const parts = p1.split('|');
      const key = parts[0].trim();
      let value = variables[key];

      if (value === undefined) return '';

      // Apply transformations sequentially
      for (let i = 1; i < parts.length; i++) {
        const transform = parts[i].trim().toLowerCase();
        
        if (transform === 'upper') value = value.toUpperCase();
        else if (transform === 'lower') value = value.toLowerCase();
        else if (transform === 'snake') value = value.replace(/[\s-]+/g, '_').toLowerCase();
        else if (transform === 'camel') value = value.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/[\s_-]+/g, '');
        else if (transform === 'pascal') value = value.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/[\s_-]+/g, '');
        else if (transform === 'trim') value = value.trim();
        else if (transform.startsWith('prefix_')) value = transform.replace('prefix_', '') + value;
        else if (transform.endsWith('_suffix')) value = value + transform.replace('_suffix', '');
      }

      return value;
    });

    return result;
  }

  static validate(pattern: string, result: string): { valid: boolean; error?: string; warning?: string } {
    if (!pattern || pattern.trim() === '') {
      return { valid: false, error: 'Pattern cannot be empty' };
    }

    const openBraces = (pattern.match(/\{\{/g) || []).length;
    const closeBraces = (pattern.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      return { valid: false, error: 'Unbalanced curly braces' };
    }

    if (result.length > 255) {
      return { valid: true, warning: `Name exceeds Meta's 255 character limit.` };
    }

    return { valid: true };
  }
}
