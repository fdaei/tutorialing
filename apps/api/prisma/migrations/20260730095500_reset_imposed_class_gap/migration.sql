-- The mandatory gap between back-to-back lessons was reversed: no gap is
-- required. `20260730093805_p1_business_rules` changed the column default to 0,
-- but a default only applies to new rows — every teacher and availability rule
-- created under the old default still imposes a 15-minute gap.
--
-- That 15 was never a deliberate teacher choice, it was the imposed default, so
-- rows still sitting on exactly that value are reset. A teacher who wants a
-- break can set one again afterwards.
UPDATE "Teacher" SET "breakMinutes" = 0 WHERE "breakMinutes" = 15;
UPDATE "AvailabilityRule" SET "breakMinutes" = 0 WHERE "breakMinutes" = 15;
