-- Drop Mercado Pago artifacts from payments: el procesador es 100% Wompi.
-- Las columnas mp_payment_id / mp_preference_id fueron introducidas en
-- 20260519130000_add_mercadopago_columns.sql y reemplazadas por
-- wompi_transaction_id en 20260602120000_migrate_to_wompi.sql. Ningún código
-- las lee ni escribe; se eliminan junto con su índice único.

drop index if exists public.payments_mp_payment_id_unique;

alter table public.payments
  drop column if exists mp_payment_id,
  drop column if exists mp_preference_id;
