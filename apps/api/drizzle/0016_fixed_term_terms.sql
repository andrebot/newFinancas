-- OQ-224: a fixed-term Holding always carries its contract terms, so a
-- projection never reads a missing rate or due date. The pair checks (0012)
-- then require the rest. No backfill: only TransactionManager opens Holdings,
-- always with their terms.
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_fixed_term_terms_check" CHECK (NOT ("investment_holdings"."asset_type" IN ('cdb', 'lc', 'lf', 'lci', 'lca', 'cra', 'cri', 'debenture', 'tesouro_direto', 'cd', 'treasury')) OR "investment_holdings"."rate_type" IS NOT NULL);