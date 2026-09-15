create or replace function public.get_limit_number_totals(
  p_dealer_id uuid,
  p_draw_period_id uuid,
  p_commission_id uuid,
  p_numbers text[],
  p_exclude_sale_id uuid default null
)
returns table(number text, dealer_total numeric, commission_total numeric)
language sql
stable
as $$
  select
    si.number,
    sum(si.amount)::numeric as dealer_total,
    coalesce(sum(si.amount) filter (where se.commission_id = p_commission_id), 0)::numeric as commission_total
  from public.sales_items si
  join public.sales_entries se on se.id = si.sales_entry_id
  where se.dealer_id = p_dealer_id
    and se.draw_period_id = p_draw_period_id
    and se.status = 'active'
    and si.number = any(p_numbers)
    and (p_exclude_sale_id is null or se.id <> p_exclude_sale_id)
  group by si.number
$$;
