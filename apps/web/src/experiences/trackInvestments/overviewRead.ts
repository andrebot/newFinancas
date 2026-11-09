import type { InvestmentHolding, InvestmentsOverviewReport } from '@financas/api-types';

// The investments overview as Track Investments' Flows take it (FL18, FL19;
// OQ-233, OQ-234): the report and the household's Holdings that name its ids,
// read once by the Experience and handed to Portfolio Overview and Holding
// Maintenance alike, so neither Flow reads the other's types.

/** The overview, as the Experience's queries hold it. */
export type OverviewRead = | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
    readonly status: 'loaded';
    readonly report: InvestmentsOverviewReport;
    /** The household's Holdings, archived ones included: what names the report's ids. */
    readonly holdings: readonly InvestmentHolding[];
  };
