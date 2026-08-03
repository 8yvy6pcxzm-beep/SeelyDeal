-- Adds brute-force/spam protection for the proposal e-sign OTP flow:
-- otp_attempts counts failed verification tries since the last code was issued
-- (sign/route.ts locks out after 5); otp_last_sent_at gates how often a new
-- code can be requested (request-otp/route.ts enforces a 30s cooldown).
alter table proposals
  add column if not exists otp_attempts int not null default 0,
  add column if not exists otp_last_sent_at timestamptz;
