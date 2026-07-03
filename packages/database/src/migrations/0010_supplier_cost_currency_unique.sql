DROP INDEX IF EXISTS supplier_cost_one_open_per_variant_unique;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_cost_one_open_per_variant_currency_unique
  ON supplier_cost(variant_id, currency)
  WHERE valid_to IS NULL;
