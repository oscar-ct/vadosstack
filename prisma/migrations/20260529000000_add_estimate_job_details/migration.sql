ALTER TABLE "estimate_records"
ADD COLUMN "jobType" TEXT NOT NULL DEFAULT 'Residential',
ADD COLUMN "measurementRooms" TEXT NOT NULL DEFAULT '[]';
