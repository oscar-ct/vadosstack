ALTER TABLE "employees" ADD COLUMN "accentColor" TEXT;

UPDATE "employees"
SET "accentColor" = (ARRAY[
  'sky', 'emerald', 'amber', 'rose',
  'indigo', 'violet', 'cyan', 'orange',
  'teal', 'pink', 'blue', 'lime',
  'fuchsia', 'red', 'purple', 'green'
])[1 + (get_byte(decode(md5("id"), 'hex'), 0) % 16)];

ALTER TABLE "employees"
ALTER COLUMN "accentColor" SET DEFAULT 'sky',
ALTER COLUMN "accentColor" SET NOT NULL;
