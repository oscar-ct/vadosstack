ALTER TABLE "jobs"
ADD COLUMN "jobType" TEXT NOT NULL DEFAULT 'Residential',
ADD COLUMN "measurementRooms" TEXT NOT NULL DEFAULT '[]';
