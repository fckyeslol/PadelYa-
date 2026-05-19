-- Add Mercado Pago specific columns to payments table.
-- wompi_reference is kept as-is and used as external_reference (our idempotency UUID).
-- wompi_transaction_id is kept for existing rows; new MP payments use mp_payment_id.

alter table public.payments
  add column if not exists mp_payment_id text,
  add column if not exists mp_preference_id text;

create unique index if not exists payments_mp_payment_id_unique
  on public.payments (mp_payment_id)
  where mp_payment_id is not null;

alter table public.payments
  alter column provider set default 'mercadopago';
