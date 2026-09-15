-- Development/demo data only: creates 200 long raw-input sales rows.
-- Safe to run once for the current active dealer/open period.
do $$
declare
  v_dealer_id uuid;
  v_period_id uuid;
  v_commission_id uuid;
  v_profile_id uuid;
  v_receipt integer;
  v_sale_id uuid;
  v_first text;
  v_second text;
  v_third text;
  v_direct_first text;
  i integer;
  n integer;
begin
  select d.id, p.id, c.id, d.owner_user_id
    into v_dealer_id, v_period_id, v_commission_id, v_profile_id
  from public.dealers d
  join public.draw_periods p on p.dealer_id = d.id and p.status = 'open'
  join public.commissions c on c.dealer_id = d.id and c.status = 'active'
  where d.status = 'active'
  order by p.created_at desc, c.created_at
  limit 1;

  if v_dealer_id is null then
    raise exception 'Active dealer, commission, and open draw period are required.';
  end if;

  if exists (
    select 1 from public.sales_entries
    where dealer_id = v_dealer_id and raw_input like 'A100' || E'\n' || '123R100' || E'\n' || '%'
  ) then
    raise notice 'Demo sales already exist for this dealer; nothing inserted.';
    return;
  end if;

  select coalesce(max(receipt_number), 0) + 1
    into v_receipt
  from public.sales_entries
  where dealer_id = v_dealer_id;

  for i in 1..200 loop
    v_first := lpad(((i * 37) % 1000)::text, 3, '0');
    v_second := lpad(((i * 71 + 11) % 1000)::text, 3, '0');
    v_third := lpad(((i * 97 + 23) % 1000)::text, 3, '0');
    v_direct_first := v_first;

    insert into public.sales_entries (
      dealer_id, commission_id, draw_period_id, receipt_number, raw_input,
      total_amount, status, created_by, created_at, updated_at
    ) values (
      v_dealer_id, v_commission_id, v_period_id, v_receipt + i - 1,
      format('A100%s123R100%s%s 200%s%s 50%s%s 25', E'\n', E'\n', v_first, E'\n', v_second, E'\n', v_third),
      1875, 'active', v_profile_id,
      now() - make_interval(mins => 200 - i),
      now() - make_interval(mins => 200 - i)
    ) returning id into v_sale_id;

    for n in 0..9 loop
      insert into public.sales_items (sales_entry_id, number, rule_type, amount, source_text)
      values (v_sale_id, repeat(n::text, 3), 'all_same', 100, 'A100');
    end loop;

    foreach v_first in array ARRAY['123','132','213','231','312','321'] loop
      insert into public.sales_items (sales_entry_id, number, rule_type, amount, source_text)
      values (v_sale_id, v_first, 'permutation', 100, '123R100');
    end loop;

    insert into public.sales_items (sales_entry_id, number, rule_type, amount, source_text)
    values
      (v_sale_id, v_direct_first, 'direct', 200, v_direct_first || ' 200'),
      (v_sale_id, v_second, 'direct', 50, v_second || ' 50'),
      (v_sale_id, v_third, 'direct', 25, v_third || ' 25');
  end loop;
end $$;
