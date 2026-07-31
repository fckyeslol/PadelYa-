-- Renombrada de 20260516133000 el 2026-07-30: el archivo existia desde mayo
-- pero NUNCA se habia aplicado en prod (prod solo tenia PK + FK + CHECK de
-- status, asi que se podian crear reembolsos duplicados por payment_id). Se
-- aplico el 2026-07-30 y quedo registrada como 20260731031044; el archivo se
-- renombra para que repo y registro coincidan 1:1.
--
-- Guarantees deterministic upsert(payment_id) for refund records.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'refunds_payment_id_unique'
  ) then
    alter table public.refunds
      add constraint refunds_payment_id_unique unique (payment_id);
  end if;
end $$;
