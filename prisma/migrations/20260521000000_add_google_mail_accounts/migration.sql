-- CreateTable
CREATE TABLE "google_mail_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "refreshTokenCipher" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_mail_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_mail_accounts_userId_key" ON "google_mail_accounts"("userId");

-- CreateIndex
CREATE INDEX "google_mail_accounts_email_idx" ON "google_mail_accounts"("email");

-- CreateIndex
CREATE INDEX "google_mail_accounts_googleSubject_idx" ON "google_mail_accounts"("googleSubject");

-- AddForeignKey
ALTER TABLE "google_mail_accounts" ADD CONSTRAINT "google_mail_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
