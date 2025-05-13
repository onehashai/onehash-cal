# Prisma Migrations with Rollback Support

Enhances Prisma's `migrate dev` by auto-generating a `down.sql` for each migration using `prisma migrate diff`. Enables safe rollbacks in CI/CD workflows.

---

## 🚀 Usage

Run the script instead of `prisma migrate dev`:

```bash
yarn db-migrate-dev

```

## 📁 Output Structure

prisma/
  └── migrations/
      └── <timestamp>_add-users-table/
          ├── migration.sql      # Prisma's up migration
          ├── down.sql           # Auto-generated rollback SQL
          └── schema.prisma
