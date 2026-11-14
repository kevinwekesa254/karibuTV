-- New WhatsApp number for support and the shop.
update public.app_settings set value = jsonb_set(value, '{whatsapp}', '"+254716855263"'), updated_at = now()
where key in ('shop', 'support') and value ->> 'whatsapp' in ('', '+254711855263');
