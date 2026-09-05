-- Seed the two real products the Growth Engine operates on.
-- Not mock data: these are the two actual business objectives from spec.
insert into public.products (name, slug, description, type, active)
values
  (
    'Zviko Labs',
    'zviko-labs',
    'Digital product and technology studio: websites, mobile/web apps, UI/UX, booking systems, e-commerce, automation, and custom software for organizations across Harare, Zimbabwe, Africa, and beyond.',
    'ZVIKO_LABS',
    true
  ),
  (
    'Dating App',
    'dating-app',
    'Zimbabwe-focused dating and social application. Growth objective: registrations, completed profiles, active users, referrals, and campaign conversions among adults 18+.',
    'DATING_APP',
    true
  )
on conflict (slug) do nothing;
