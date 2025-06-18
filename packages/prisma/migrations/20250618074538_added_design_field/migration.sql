-- CreateEnum
CREATE TYPE "Design" AS ENUM ('modern', 'legacy');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "design" "Design" NOT NULL DEFAULT 'modern';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "design" "Design" NOT NULL DEFAULT 'modern';
