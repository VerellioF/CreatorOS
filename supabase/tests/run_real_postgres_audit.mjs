import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = fs.existsSync(path.resolve(__dirname, "../migrations/20261030000000_phase1_foundation.sql"))
  ? path.resolve(__dirname, "../..")
  : "d:\\CreatorOS AI";

const MIGRATION_PATH = path.join(REPO_ROOT, "supabase", "migrations", "20261030000000_phase1_foundation.sql");
const SQL_SUITE_PATH = path.join(REPO_ROOT, "supabase", "tests", "security_hardening_audit.sql");
const PG_PORT = 55439;
const PG_DATA_DIR = path.join(process.cwd(), "pgdata_ephemeral");

async function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Executes queries inside a transaction simulating Supabase PostgREST / Auth context.
 * Connects as non-superuser `authenticator` so PostgreSQL RLS & ACLs are 100% enforced.
 */
async function withRoleContext(pool, { role = "authenticated", userId = null, isolation = "READ COMMITTED" }, fn) {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    await client.query(`SET LOCAL ROLE ${role}`);
    if (userId) {
      await client.query(`SELECT pg_catalog.set_config('request.jwt.claim.sub', $1, true)`, [userId]);
      await client.query(
        `SELECT pg_catalog.set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify({ sub: userId, role })]
      );
    } else {
      await client.query(`SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true)`);
      await client.query(`SELECT pg_catalog.set_config('request.jwt.claims', '', true)`);
    }
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function expectReject(promiseFactory, expectedSubstring, label) {
  let failed = false;
  let errMsg = "";
  try {
    await promiseFactory();
  } catch (err) {
    failed = true;
    errMsg = err?.message || String(err);
  }
  assert.equal(failed, true, `[FAIL] Expected rejection for (${label}), but operation succeeded!`);
  if (expectedSubstring) {
    const regex = expectedSubstring instanceof RegExp ? expectedSubstring : new RegExp(expectedSubstring, "i");
    assert.match(errMsg, regex, `[FAIL] Unexpected error message for (${label}): ${errMsg}`);
  }
  return errMsg;
}

async function main() {
  await cleanDir(PG_DATA_DIR);

  const embeddedPg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: "postgres",
    password: "postgres_local_test_password",
    port: PG_PORT,
    persistent: false,
    onLog: () => {},
    onError: (msg) => {
      if (String(msg).includes("FATAL")) console.error("[PG-ERR]", msg);
    },
  });

  console.log("=== INITIALIZING EPHEMERAL LOCAL POSTGRESQL SANDBOX ===");
  await embeddedPg.initialise();
  await embeddedPg.start();

  const superPool = new Pool({
    host: "127.0.0.1",
    port: PG_PORT,
    user: "postgres",
    password: "postgres_local_test_password",
    database: "postgres",
    max: 10,
  });

  let authPool = null;
  const results = [];

  const recordTest = async (num, name, fn) => {
    const start = Date.now();
    try {
      const detail = await fn();
      const ms = Date.now() - start;
      results.push({ num, name, status: "PASS", ms, detail });
      console.log(`[PASS] Test #${String(num).padStart(2, "0")} (${ms}ms): ${name} — ${detail}`);
    } catch (err) {
      const ms = Date.now() - start;
      results.push({ num, name, status: "FAIL", ms, detail: err?.message || String(err) });
      console.error(`[FAIL] Test #${String(num).padStart(2, "0")} (${ms}ms): ${name}\n   -> ${err?.stack || err}`);
      throw err;
    }
  };

  try {
    const verRes = await superPool.query("SELECT version()");
    console.log("Engine:", verRes.rows[0].version);

    // 1. Bootstrap authentic Supabase roles & auth schema
    await superPool.query(`
      CREATE ROLE anon NOLOGIN NOINHERIT;
      CREATE ROLE authenticated NOLOGIN NOINHERIT;
      CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
      CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
      CREATE ROLE authenticator LOGIN PASSWORD 'authenticator_pw' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE;

      GRANT anon, authenticated, service_role, supabase_auth_admin TO authenticator;

      CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
      GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role, supabase_auth_admin;

      CREATE TABLE auth.users (
          id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
          email TEXT UNIQUE,
          raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL
      );
      ALTER TABLE auth.users OWNER TO supabase_auth_admin;
      GRANT ALL ON TABLE auth.users TO postgres, supabase_auth_admin, service_role;

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT COALESCE(
          NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
          (NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::uuid;
      $$;
      ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
      GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
    `);

    // 1B. Seed pre-migration legacy tables with dirty data & old RESTRICT FK to verify
    // pre-constraint sanitization & schema evolution compatibility BEFORE applying migration!
    const UID_PRE_DIRTY = "09000000-0000-4000-8000-000000000001";
    const WS_PRE_DIRTY = "09900000-0000-4000-8000-000000000001";
    await superPool.query(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES ('${UID_PRE_DIRTY}', 'dirty.pre@creatoros.id', '{"full_name": "X"}'::jsonb);

      CREATE TABLE public.profiles (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          full_name TEXT NOT NULL,
          avatar_url TEXT,
          preferred_language VARCHAR(10) DEFAULT 'id' NOT NULL,
          theme_preference VARCHAR(10) DEFAULT 'system' NOT NULL,
          onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL
      );
      INSERT INTO public.profiles (id, full_name, preferred_language, theme_preference)
      VALUES ('${UID_PRE_DIRTY}', ' ', 'fr', 'neon');

      CREATE TABLE public.workspaces (
          id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          creator_mode VARCHAR(30) DEFAULT 'creator' NOT NULL,
          logo_url TEXT,
          created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
          deleted_at TIMESTAMPTZ
      );
      INSERT INTO public.workspaces (id, name, slug, creator_mode, created_by)
      VALUES ('${WS_PRE_DIRTY}', '!', 'INVALID_UPPER_SLUG!', 'legacy_mode', '${UID_PRE_DIRTY}');
    `);

    // 2. Apply our Phase 1 migration SQL verbatim TWICE (verifies legacy upgrade + idempotency!)
    const migrationSql = fs.readFileSync(MIGRATION_PATH, "utf8");
    await superPool.query(migrationSql);
    await superPool.query(migrationSql);
    console.log("Migration applied twice cleanly over legacy dirty schema (upgrade + idempotent DDL verified).\n");

    // Non-superuser pool replicating Supabase PostgREST `authenticator` connection
    authPool = new Pool({
      host: "127.0.0.1",
      port: PG_PORT,
      user: "authenticator",
      password: "authenticator_pw",
      database: "postgres",
      max: 25,
    });

    const signUpUser = async (id, email, fullName) => {
      await withRoleContext(authPool, { role: "supabase_auth_admin", userId: null }, async (c) => {
        await c.query(
          `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)`,
          [id, email, JSON.stringify(fullName !== undefined ? { full_name: fullName } : {})]
        );
      });
    };

    const deleteAuthUser = async (id) => {
      await withRoleContext(authPool, { role: "supabase_auth_admin", userId: null }, async (c) => {
        await c.query(`DELETE FROM auth.users WHERE id = $1`, [id]);
      });
    };

    // Provision core actors across two distinct workspaces (Workspace A & Workspace B)
    const UID_OWNER_A = "10000000-0000-4000-8000-000000000001";
    const UID_ADMIN_A = "10000000-0000-4000-8000-000000000002";
    const UID_ADMIN2_A = "10000000-0000-4000-8000-000000000003";
    const UID_EDITOR_A = "10000000-0000-4000-8000-000000000004";
    const UID_VIEWER_A = "10000000-0000-4000-8000-000000000005";
    const UID_MEMBER_A = "10000000-0000-4000-8000-000000000006";
    const UID_OWNER_B = "20000000-0000-4000-8000-000000000001";
    const UID_MEMBER_B = "20000000-0000-4000-8000-000000000002";

    for (const [id, email, name] of [
      [UID_OWNER_A, "owner.a@creatoros.id", "Owner Alpha"],
      [UID_ADMIN_A, "admin.a@creatoros.id", "Admin Alpha"],
      [UID_ADMIN2_A, "admin2.a@creatoros.id", "Admin Two Alpha"],
      [UID_EDITOR_A, "editor.a@creatoros.id", "Editor Alpha"],
      [UID_VIEWER_A, "viewer.a@creatoros.id", "Viewer Alpha"],
      [UID_MEMBER_A, "member.a@creatoros.id", "Member Alpha"],
      [UID_OWNER_B, "owner.b@creatoros.id", "Owner Beta"],
      [UID_MEMBER_B, "member.b@creatoros.id", "Member Beta"],
    ]) {
      await signUpUser(id, email, name);
    }

    const wsA = await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
      const r = await c.query(`SELECT id FROM public.workspaces WHERE created_by = $1`, [UID_OWNER_A]);
      assert.equal(r.rowCount, 1);
      return r.rows[0].id;
    });
    const wsB = await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_B }, async (c) => {
      const r = await c.query(`SELECT id FROM public.workspaces WHERE created_by = $1`, [UID_OWNER_B]);
      assert.equal(r.rowCount, 1);
      return r.rows[0].id;
    });

    // Populate Workspace A & Workspace B via validated RPC `add_workspace_member`
    await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
      await c.query(`SELECT public.add_workspace_member($1, $2, 'admin')`, [wsA, UID_ADMIN_A]);
      await c.query(`SELECT public.add_workspace_member($1, $2, 'admin')`, [wsA, UID_ADMIN2_A]);
      await c.query(`SELECT public.add_workspace_member($1, $2, 'editor')`, [wsA, UID_EDITOR_A]);
      await c.query(`SELECT public.add_workspace_member($1, $2, 'viewer')`, [wsA, UID_VIEWER_A]);
      await c.query(`SELECT public.add_workspace_member($1, $2, 'member')`, [wsA, UID_MEMBER_A]);
    });
    await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_B }, async (c) => {
      await c.query(`SELECT public.add_workspace_member($1, $2, 'member')`, [wsB, UID_MEMBER_B]);
    });

    // Helper for seeding a legacy 2nd co-owner strictly via tokenized internal call when testing multi-owner races
    const seedSecondCoOwner = async (workspaceId, coOwnerUserId) => {
      const client = await superPool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SELECT creatoros_internal.lock_workspace_boundary($1)`, [workspaceId]);
        // Temporarily insert co-owner by disabling user trigger ONLY inside superuser test setup
        await client.query(`ALTER TABLE public.workspace_members DISABLE TRIGGER trigger_workspace_member_safety`);
        await client.query(
          `INSERT INTO public.workspace_members (workspace_id, user_id, role)
           VALUES ($1, $2, 'owner')
           ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'`,
          [workspaceId, coOwnerUserId]
        );
        await client.query(`ALTER TABLE public.workspace_members ENABLE TRIGGER trigger_workspace_member_safety`);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    };

    // =========================================================================
    // TEST 01: Tenant Isolation (2+ Authenticated Users & 2+ Workspaces)
    // =========================================================================
    await recordTest(1, "Tenant isolation antara dua pengguna authenticated dan dua workspace berbeda", async () => {
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_B }, async (c) => {
        const visibleWs = await c.query(`SELECT id FROM public.workspaces`);
        assert.deepEqual(visibleWs.rows.map((r) => r.id), [wsB], "Owner B sees ONLY Workspace B");

        const visibleSettings = await c.query(`SELECT workspace_id FROM public.workspace_settings`);
        assert.deepEqual(visibleSettings.rows.map((r) => r.workspace_id), [wsB], "Owner B sees ONLY Workspace B settings");

        const hasAccessA = await c.query(`SELECT public.has_workspace_access($1, 'viewer') AS ok`, [wsA]);
        assert.equal(hasAccessA.rows[0].ok, false, "has_workspace_access(wsA) must be FALSE for Owner B");

        const nonCoworkerProfile = await c.query(`SELECT id FROM public.profiles WHERE id = $1`, [UID_OWNER_A]);
        assert.equal(nonCoworkerProfile.rowCount, 0, "Non-coworker profile must not be visible");

        const coworkerProfile = await c.query(`SELECT id FROM public.profiles WHERE id = $1`, [UID_MEMBER_B]);
        assert.equal(coworkerProfile.rowCount, 1, "Coworker profile in same workspace IS visible");
      });

      // Also verify `anon` has USAGE on schema public (PostgREST safe) yet 0 table/function access
      await expectReject(
        () => withRoleContext(authPool, { role: "anon", userId: null }, (c) => c.query(`SELECT * FROM public.workspaces`)),
        /permission denied for table workspaces/i,
        "anon SELECT workspaces"
      );
      await expectReject(
        () => withRoleContext(authPool, { role: "anon", userId: null }, (c) =>
          c.query(`SELECT public.has_workspace_access($1, 'viewer')`, [wsA])
        ),
        /permission denied for function has_workspace_access/i,
        "anon EXECUTE has_workspace_access"
      );

      return "Strict isolation verified across workspaces, memberships, settings, profiles, and anon ACLs";
    });

    // =========================================================================
    // TEST 02: Cross-Tenant SELECT, INSERT, UPDATE, DELETE & RPCs
    // =========================================================================
    await recordTest(2, "Cross-tenant SELECT, INSERT, UPDATE, DELETE & RPC ditolak penuh", async () => {
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_B }, async (c) => {
        assert.equal((await c.query(`SELECT * FROM public.workspaces WHERE id = $1`, [wsA])).rowCount, 0);
        assert.equal((await c.query(`SELECT * FROM public.workspace_members WHERE workspace_id = $1`, [wsA])).rowCount, 0);
        assert.equal((await c.query(`SELECT * FROM public.workspace_settings WHERE workspace_id = $1`, [wsA])).rowCount, 0);

        assert.equal((await c.query(`UPDATE public.workspaces SET name = 'Pwned' WHERE id = $1`, [wsA])).rowCount, 0);
        assert.equal((await c.query(`DELETE FROM public.workspaces WHERE id = $1`, [wsA])).rowCount, 0);
        assert.equal((await c.query(`UPDATE public.workspace_settings SET default_language = 'en' WHERE workspace_id = $1`, [wsA])).rowCount, 0);
        assert.equal((await c.query(`UPDATE public.profiles SET full_name = 'Pwned' WHERE id = $1`, [UID_OWNER_A])).rowCount, 0);
      });

      // Cross-tenant INSERT spoofing created_by
      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_B }, (c) =>
          c.query(`INSERT INTO public.workspaces (name, slug, creator_mode, created_by) VALUES ('Spoof', 'spoof-ws', 'creator', $1)`, [UID_OWNER_A])
        ),
        /created_by must match authenticated user|row-level security/i,
        "spoof foreign created_by on workspace INSERT"
      );

      // Cross-tenant INSERT on workspace_settings
      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_B }, (c) =>
          c.query(`INSERT INTO public.workspace_settings (workspace_id) VALUES ($1)`, [wsA])
        ),
        /row-level security/i,
        "foreign workspace_settings INSERT"
      );

      // Cross-tenant RPC calls against wsA
      for (const [label, sql, params] of [
        ["add_workspace_member", `SELECT public.add_workspace_member($1, $2, 'member')`, [wsA, UID_OWNER_B]],
        ["update_workspace_member_role", `SELECT public.update_workspace_member_role($1, $2, 'admin')`, [wsA, UID_MEMBER_A]],
        ["remove_workspace_member", `SELECT public.remove_workspace_member($1, $2)`, [wsA, UID_MEMBER_A]],
        ["transfer_workspace_ownership", `SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_OWNER_B]],
      ]) {
        await expectReject(
          () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_B }, (c) => c.query(sql, params)),
          /not a member|Only a workspace owner/i,
          `cross-tenant ${label}`
        );
      }

      return "All cross-tenant SELECT/INSERT/UPDATE/DELETE and foreign RPC invocations blocked";
    });

    // =========================================================================
    // TEST 03: Role Escalation, Direct DML Block, Internal Schema & Function Grants
    // =========================================================================
    await recordTest(3, "Role escalation, direct DML workspace_members, GUC spoof & fungsi internal diblokir", async () => {
      // 3a. Direct INSERT/UPDATE/DELETE on workspace_members is revoked even for authenticated Owner!
      for (const [op, sql, params] of [
        ["INSERT", `INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')`, [wsA, UID_OWNER_B]],
        ["UPDATE", `UPDATE public.workspace_members SET role = 'editor' WHERE workspace_id = $1 AND user_id = $2`, [wsA, UID_MEMBER_A]],
        ["DELETE", `DELETE FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2`, [wsA, UID_MEMBER_A]],
      ]) {
        await expectReject(
          () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) => c.query(sql, params)),
          /permission denied for table workspace_members/i,
          `direct ${op} on workspace_members`
        );
      }

      // 3b. Defense-in-depth: even superuser `postgres` direct un-tokenized DML is blocked by trigger!
      const eSuperDirect = await expectReject(
        () => superPool.query(`INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')`, [wsA, UID_OWNER_B]),
        /Direct table modifications on workspace_members are prohibited/i,
        "un-tokenized superuser direct INSERT"
      );

      // 3c. Lower roles (editor, viewer, member) cannot add or escalate roles via RPC
      for (const uid of [UID_EDITOR_A, UID_VIEWER_A, UID_MEMBER_A]) {
        await expectReject(
          () => withRoleContext(authPool, { role: "authenticated", userId: uid }, (c) =>
            c.query(`SELECT public.update_workspace_member_role($1, $2, 'admin')`, [wsA, uid])
          ),
          /Insufficient permissions/i,
          `role escalation by ${uid}`
        );
        await expectReject(
          () => withRoleContext(authPool, { role: "authenticated", userId: uid }, (c) =>
            c.query(`SELECT public.add_workspace_member($1, $2, 'member')`, [wsA, UID_OWNER_B])
          ),
          /Insufficient permissions/i,
          `add member by ${uid}`
        );
      }

      // 3d. Custom GUC spoofing + internal schema + non-client trigger functions have ZERO EXECUTE grant
      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, async (c) => {
          await c.query(`SELECT pg_catalog.set_config('creatoros.internal_operation', 'true', true)`);
          await c.query(`SELECT pg_catalog.set_config('creatoros.ownership_transfer_active', 'true', true)`);
          await c.query(`SELECT public.update_workspace_member_role($1, $2, 'owner')`, [wsA, UID_ADMIN_A]);
        }),
        /Admins cannot modify owners or admins|Direct owner role modifications/i,
        "custom GUC spoofing"
      );

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT creatoros_internal.issue_trusted_token('provision_owner', 'INSERT', $1, $2, $2, NULL, 'owner')`, [wsA, UID_OWNER_A])
        ),
        /permission denied for schema creatoros_internal/i,
        "authenticated calling creatoros_internal.issue_trusted_token"
      );

      for (const fnCall of [
        `SELECT public.set_updated_at()`,
        `SELECT public.enforce_immutable_tenant_keys()`,
        `SELECT public.prepare_workspace_insert()`,
        `SELECT public.handle_new_workspace()`,
        `SELECT public.enforce_workspace_member_safety()`,
        `SELECT public.handle_new_user()`,
        `SELECT public.handle_auth_user_deletion()`,
      ]) {
        await expectReject(
          () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) => c.query(fnCall)),
          /permission denied for function/i,
          `EXECUTE revoked on trigger function: ${fnCall}`
        );
      }

      // 3e. Immutable tenant keys (`workspaces.created_by` cannot be changed or set NULL while user exists!)
      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`UPDATE public.workspaces SET created_by = NULL WHERE id = $1`, [wsA])
        ),
        /Workspace id and created_by are immutable/i,
        "owner setting created_by = NULL"
      );

      return `ACLs + trigger blocked direct DML (${eSuperDirect}), GUC spoof, trigger EXECUTE, and key tampering`;
    });

    // =========================================================================
    // TEST 04: Admin Mencoba Membuat, Mengubah, atau Menghapus Admin
    // =========================================================================
    await recordTest(4, "Admin mencoba membuat, mengubah, atau menghapus admin lain ditolak", async () => {
      const eAdd = await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.add_workspace_member($1, $2, 'admin')`, [wsA, UID_OWNER_B])
        ),
        /Only workspace owners can assign the admin role/i,
        "admin adding admin"
      );

      const ePromote = await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.update_workspace_member_role($1, $2, 'admin')`, [wsA, UID_EDITOR_A])
        ),
        /Only workspace owners can grant or revoke the admin role/i,
        "admin promoting editor to admin"
      );

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.update_workspace_member_role($1, $2, 'member')`, [wsA, UID_ADMIN2_A])
        ),
        /Admins cannot modify owners or admins/i,
        "admin demoting another admin"
      );

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, UID_ADMIN2_A])
        ),
        /Admins cannot remove owners or other admins/i,
        "admin removing another admin"
      );

      // Verify Admin CAN manage editor/viewer/member
      await withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, async (c) => {
        const res = await c.query(`SELECT public.update_workspace_member_role($1, $2, 'editor') AS ok`, [wsA, UID_MEMBER_A]);
        assert.equal(res.rows[0].ok, true);
        await c.query(`SELECT public.update_workspace_member_role($1, $2, 'member')`, [wsA, UID_MEMBER_A]);
      });

      return `Admin->admin add (${eAdd}) & promote (${ePromote}) & peer-admin modification/removal rejected`;
    });

    // =========================================================================
    // TEST 05: Admin Mencoba Mengubah atau Menghapus Owner
    // =========================================================================
    await recordTest(5, "Admin mencoba mengubah, menghapus, atau mengambil alih owner ditolak", async () => {
      const eMod = await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.update_workspace_member_role($1, $2, 'member')`, [wsA, UID_OWNER_A])
        ),
        /Admins cannot modify owners or admins/i,
        "admin demoting owner"
      );

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.update_workspace_member_role($1, $2, 'owner')`, [wsA, UID_OWNER_A])
        ),
        /Admins cannot modify owners or admins/i,
        "admin touching owner"
      );

      const eRem = await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, UID_OWNER_A])
        ),
        /Admins cannot remove owners or other admins/i,
        "admin removing owner"
      );

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_ADMIN_A])
        ),
        /Only a workspace owner can transfer ownership/i,
        "admin calling transfer_workspace_ownership"
      );

      return `Modify blocked (${eMod}); Remove blocked (${eRem}); Transfer blocked`;
    });

    // =========================================================================
    // TEST 06: Owner Menambah, Mengubah & Menghapus Anggota + Aturan Co-Owner
    // =========================================================================
    await recordTest(6, "Owner menambah, mengubah & menghapus anggota + larangan hapus co-owner langsung", async () => {
      const UID_TEMP_MEMBER = "10000000-0000-4000-8000-000000000060";
      await signUpUser(UID_TEMP_MEMBER, "temp60@creatoros.id", "Temp Member");

      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        const addRes = await c.query(`SELECT public.add_workspace_member($1, $2, 'viewer') AS id`, [wsA, UID_TEMP_MEMBER]);
        assert.ok(addRes.rows[0].id);

        // Owner promotes to admin, then demotes to editor, then removes
        await c.query(`SELECT public.update_workspace_member_role($1, $2, 'admin')`, [wsA, UID_TEMP_MEMBER]);
        await c.query(`SELECT public.update_workspace_member_role($1, $2, 'editor')`, [wsA, UID_TEMP_MEMBER]);
        const remRes = await c.query(`SELECT public.remove_workspace_member($1, $2) AS ok`, [wsA, UID_TEMP_MEMBER]);
        assert.equal(remRes.rows[0].ok, true);
      });

      // Verify Co-Owner Policy: Owner 1 CANNOT directly delete Owner 2 without transfer!
      await seedSecondCoOwner(wsA, UID_TEMP_MEMBER);
      const eCoOwnerDel = await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, UID_TEMP_MEMBER])
        ),
        /Cannot remove another workspace owner directly/i,
        "owner attempting to directly delete another co-owner"
      );

      // Instead, co-owner steps down via `transfer_workspace_ownership(wsA, UID_OWNER_A)` -> becomes admin -> Owner A removes them!
      await withRoleContext(authPool, { role: "authenticated", userId: UID_TEMP_MEMBER }, async (c) => {
        await c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_OWNER_A]);
      });
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        await c.query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, UID_TEMP_MEMBER]);
      });

      return `Owner CRUD verified; hostile co-owner removal blocked (${eCoOwnerDel}); transfer-then-remove succeeded`;
    });

    // =========================================================================
    // TEST 07: Last-Owner Deletion & Demotion (READ COMMITTED, REPEATABLE READ, SERIALIZABLE)
    // =========================================================================
    await recordTest(7, "Last-owner deletion & demotion aman pada READ COMMITTED, REPEATABLE READ, dan SERIALIZABLE", async () => {
      // 7a. Single-session last-owner deletion & demotion blocked
      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, UID_OWNER_A])
        ),
        /The last remaining owner cannot leave or be removed/i,
        "last owner self-remove"
      );

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT public.update_workspace_member_role($1, $2, 'admin')`, [wsA, UID_OWNER_A])
        ),
        /Direct owner role modifications are prohibited/i,
        "last owner direct demote"
      );

      // 7b. Concurrent self-removal of 2 co-owners across ALL THREE PostgreSQL isolation levels!
      const UID_CO_ISO = "10000000-0000-4000-8000-000000000070";
      await signUpUser(UID_CO_ISO, "coiso@creatoros.id", "Co Owner Iso");

      for (const iso of ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"]) {
        await seedSecondCoOwner(wsA, UID_CO_ISO);

        const c1 = await authPool.connect();
        const c2 = await authPool.connect();
        let c2Err = null;
        try {
          await c1.query(`BEGIN ISOLATION LEVEL ${iso}`);
          await c1.query(`SET LOCAL ROLE authenticated`);
          await c1.query(`SELECT pg_catalog.set_config('request.jwt.claim.sub', $1, true)`, [UID_CO_ISO]);

          await c2.query(`BEGIN ISOLATION LEVEL ${iso}`);
          await c2.query(`SET LOCAL ROLE authenticated`);
          await c2.query(`SELECT pg_catalog.set_config('request.jwt.claim.sub', $1, true)`, [UID_OWNER_A]);
          // Force snapshot establishment in c2 BEFORE c1 mutates!
          await c2.query(`SELECT count(*) FROM public.workspace_members WHERE workspace_id = $1`, [wsA]);

          // c1 removes UID_CO_ISO (holds Level 1 workspace_locks + workspaces FOR UPDATE)
          await c1.query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, UID_CO_ISO]);

          // c2 concurrently tries to remove UID_OWNER_A -> blocks on Level 1 lock
          const p2 = c2
            .query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, UID_OWNER_A])
            .then(() => c2.query("COMMIT"))
            .catch(async (e) => {
              c2Err = e;
              await c2.query("ROLLBACK").catch(() => {});
            });

          await new Promise((r) => setTimeout(r, 75));
          await c1.query("COMMIT");
          await p2;
        } finally {
          c1.release();
          c2.release();
        }

        assert.ok(c2Err, `Second concurrent owner removal MUST fail under ${iso}`);
        assert.doesNotMatch(c2Err.message, /deadlock/i, `Zero deadlocks under ${iso}`);

        const cnt = await superPool.query(
          `SELECT count(*)::int AS c FROM public.workspace_members WHERE workspace_id = $1 AND role = 'owner'`,
          [wsA]
        );
        assert.equal(cnt.rows[0].c, 1, `Workspace MUST retain 1 owner under ${iso}`);
      }

      return "Last-owner invariant preserved across READ COMMITTED (domain block), REPEATABLE READ (40001), and SERIALIZABLE (40001)";
    });

    // =========================================================================
    // TEST 08: Direct Owner Promotion Prohibited
    // =========================================================================
    await recordTest(8, "Direct owner promotion dilarang baik melalui add_workspace_member maupun update_workspace_member_role", async () => {
      const eAddOwner = await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT public.add_workspace_member($1, $2, 'owner')`, [wsA, UID_OWNER_B])
        ),
        /Direct owner assignment is prohibited/i,
        "owner calling add_workspace_member with role=owner"
      );

      const eUpdOwner = await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT public.update_workspace_member_role($1, $2, 'owner')`, [wsA, UID_ADMIN_A])
        ),
        /Direct owner role modifications are prohibited/i,
        "owner calling update_workspace_member_role with role=owner"
      );

      return `add_workspace_member('owner') blocked (${eAddOwner}); update_workspace_member_role('owner') blocked (${eUpdOwner})`;
    });

    // =========================================================================
    // TEST 09: Ownership Transfer, Single-Use Token Validation & UPDATE #2 Failure Rollback
    // =========================================================================
    await recordTest(9, "Ownership transfer: validasi single-use token pada kedua UPDATE & rollback penuh saat UPDATE #2 gagal", async () => {
      // 9a. Strict token field binding & single-use consumption audit
      await expectReject(
        () => superPool.query(`
          BEGIN;
          -- Issue a token for UID_EDITOR_A, then attempt to use it on UID_VIEWER_A -> MUST FAIL!
          SELECT creatoros_internal.issue_trusted_token('member_update_role', 'UPDATE', '${wsA}', '${UID_OWNER_A}', '${UID_EDITOR_A}', 'editor', 'admin');
          SET LOCAL ROLE postgres;
          SELECT pg_catalog.set_config('request.jwt.claim.sub', '${UID_OWNER_A}', true);
          UPDATE public.workspace_members SET role = 'admin' WHERE workspace_id = '${wsA}' AND user_id = '${UID_VIEWER_A}';
          COMMIT;
        `),
        /Direct table modifications on workspace_members are prohibited/i,
        "token bound to specific target_user_id & expected_old_role"
      ).finally(() => superPool.query("ROLLBACK").catch(() => {}));

      // Verify single token CANNOT authorize 2 rows even if matching role!
      await expectReject(
        () => superPool.query(`
          BEGIN;
          SELECT creatoros_internal.issue_trusted_token('member_update_role', 'UPDATE', '${wsA}', '${UID_OWNER_A}', '${UID_ADMIN_A}', 'admin', 'editor');
          SELECT pg_catalog.set_config('request.jwt.claim.sub', '${UID_OWNER_A}', true);
          -- First UPDATE consumes the token
          UPDATE public.workspace_members SET role = 'editor' WHERE workspace_id = '${wsA}' AND user_id = '${UID_ADMIN_A}';
          -- Second identical/reverse UPDATE without new token MUST FAIL because token was deleted on first row!
          UPDATE public.workspace_members SET role = 'viewer' WHERE workspace_id = '${wsA}' AND user_id = '${UID_ADMIN_A}';
          COMMIT;
        `),
        /Direct table modifications on workspace_members are prohibited/i,
        "single-use token consumed on 1st row, 2nd row rejected"
      ).finally(() => superPool.query("ROLLBACK").catch(() => {}));

      // 9b. Simulate failure specifically on UPDATE #2 (`owner -> admin` demotion) of `transfer_workspace_ownership`!
      await superPool.query(`
        CREATE OR REPLACE FUNCTION creatoros_internal.zz_fail_transfer_step2()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
          IF OLD.role = 'owner' AND NEW.role = 'admin' THEN
            RAISE EXCEPTION 'Simulated failure on UPDATE #2 (actor demotion)';
          END IF;
          RETURN NEW;
        END;
        $$;
        CREATE TRIGGER zz_test_fail_step2
          BEFORE UPDATE ON public.workspace_members
          FOR EACH ROW EXECUTE FUNCTION creatoros_internal.zz_fail_transfer_step2();
      `);

      try {
        await expectReject(
          () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
            c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_ADMIN_A])
          ),
          /Simulated failure on UPDATE #2/i,
          "transfer UPDATE #2 failure"
        );
      } finally {
        await superPool.query(`
          DROP TRIGGER IF EXISTS zz_test_fail_step2 ON public.workspace_members;
          DROP FUNCTION IF EXISTS creatoros_internal.zz_fail_transfer_step2();
        `);
      }

      // Verify UPDATE #1 (`UID_ADMIN_A -> owner`) was 100% rolled back!
      const afterFail = await superPool.query(
        `SELECT user_id, role FROM public.workspace_members WHERE workspace_id = $1 AND user_id IN ($2, $3)`,
        [wsA, UID_OWNER_A, UID_ADMIN_A]
      );
      const roleMapFail = Object.fromEntries(afterFail.rows.map((r) => [r.user_id, r.role]));
      assert.equal(roleMapFail[UID_OWNER_A], "owner", "UID_OWNER_A must still be owner after UPDATE #2 rollback");
      assert.equal(roleMapFail[UID_ADMIN_A], "admin", "UID_ADMIN_A promotion in UPDATE #1 must be rolled back");

      const tokCnt1 = await superPool.query(`SELECT count(*)::int AS c FROM creatoros_internal.trusted_operations`);
      assert.equal(tokCnt1.rows[0].c, 0, "Zero lingering tokens after rollback");

      // 9c. Normal atomic transfer succeeds & swaps roles cleanly
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        const ok = await c.query(`SELECT public.transfer_workspace_ownership($1, $2) AS ok`, [wsA, UID_ADMIN_A]);
        assert.equal(ok.rows[0].ok, true);
      });
      await withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, async (c) => {
        await c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_OWNER_A]);
      });

      const tokCnt2 = await superPool.query(`SELECT count(*)::int AS c FROM creatoros_internal.trusted_operations`);
      assert.equal(tokCnt2.rows[0].c, 0, "Zero lingering tokens after successful transfers");

      return "Single-use token binding verified, UPDATE #2 failure rolled back UPDATE #1 100%, normal swap clean";
    });

    // =========================================================================
    // TEST 10: Concurrent Ownership Transfers (Same Owner + Two Simultaneous Co-Owners)
    // =========================================================================
    await recordTest(10, "Transfer kepemilikan simultan (single owner & dua co-owner bersamaan) tanpa kondisi 0-owner", async () => {
      // 10a. Single owner fires two simultaneous transfers on parallel connections
      const c1 = await authPool.connect();
      const c2 = await authPool.connect();
      let c2Err = null;
      try {
        await c1.query("BEGIN");
        await c1.query("SET LOCAL ROLE authenticated");
        await c1.query(`SELECT pg_catalog.set_config('request.jwt.claim.sub', $1, true)`, [UID_OWNER_A]);
        await c1.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_EDITOR_A]);

        await c2.query("BEGIN");
        await c2.query("SET LOCAL ROLE authenticated");
        await c2.query(`SELECT pg_catalog.set_config('request.jwt.claim.sub', $1, true)`, [UID_OWNER_A]);
        const p2 = c2
          .query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_VIEWER_A])
          .then(() => c2.query("COMMIT"))
          .catch(async (e) => {
            c2Err = e;
            await c2.query("ROLLBACK").catch(() => {});
          });

        await new Promise((r) => setTimeout(r, 75));
        await c1.query("COMMIT");
        await p2;
      } finally {
        c1.release();
        c2.release();
      }
      assert.ok(c2Err);
      assert.doesNotMatch(c2Err.message, /deadlock/i);
      assert.match(c2Err.message, /Only a workspace owner can transfer ownership/i);

      // Restore UID_OWNER_A & UID_EDITOR_A
      await withRoleContext(authPool, { role: "authenticated", userId: UID_EDITOR_A }, (c) =>
        c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_OWNER_A])
      );
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
        c.query(`SELECT public.update_workspace_member_role($1, $2, 'editor')`, [wsA, UID_EDITOR_A])
      );

      // 10b. TWO DISTINCT CO-OWNERS simultaneously transferring to two different members (`Owner A -> Editor` & `Owner Co -> Viewer`)
      const UID_CO2 = "10000000-0000-4000-8000-000000000099";
      await signUpUser(UID_CO2, "co2@creatoros.id", "Second CoOwner");
      await seedSecondCoOwner(wsA, UID_CO2);

      const outcomesDisjoint = await Promise.allSettled([
        withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_EDITOR_A])
        ),
        withRoleContext(authPool, { role: "authenticated", userId: UID_CO2 }, (c) =>
          c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_VIEWER_A])
        ),
      ]);
      const dl1 = outcomesDisjoint.filter((o) => o.status === "rejected" && /deadlock/i.test(o.reason?.message || ""));
      assert.equal(dl1.length, 0, "Zero deadlocks when 2 co-owners transfer to disjoint targets");

      // Both Editor and Viewer are now owners! Now test symmetric cross-transfer (`Editor -> Viewer` vs `Viewer -> Editor`)!
      const outcomesCross = await Promise.allSettled([
        withRoleContext(authPool, { role: "authenticated", userId: UID_EDITOR_A }, (c) =>
          c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_VIEWER_A])
        ),
        withRoleContext(authPool, { role: "authenticated", userId: UID_VIEWER_A }, (c) =>
          c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_EDITOR_A])
        ),
      ]);
      const dl2 = outcomesCross.filter((o) => o.status === "rejected" && /deadlock/i.test(o.reason?.message || ""));
      assert.equal(dl2.length, 0, "Zero deadlocks on symmetric co-owner cross-transfer");

      const ownersNow = await superPool.query(
        `SELECT user_id FROM public.workspace_members WHERE workspace_id = $1 AND role = 'owner'`,
        [wsA]
      );
      assert.ok(ownersNow.rowCount >= 1, "At least 1 owner must always remain");

      // Normalize Workspace A back to initial roles
      for (const r of ownersNow.rows) {
        if (r.user_id !== UID_OWNER_A) {
          await withRoleContext(authPool, { role: "authenticated", userId: r.user_id }, (c) =>
            c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_OWNER_A])
          );
        }
      }
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        await c.query(`SELECT public.update_workspace_member_role($1, $2, 'editor')`, [wsA, UID_EDITOR_A]);
        await c.query(`SELECT public.update_workspace_member_role($1, $2, 'viewer')`, [wsA, UID_VIEWER_A]);
        await c.query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, UID_CO2]);
      });

      return "0 deadlocks & >=1 owner preserved across same-owner double-submit, 2-owner disjoint transfer, and 2-owner cross-transfer";
    });

    // =========================================================================
    // TEST 11: Provisioning Signup
    // =========================================================================
    await recordTest(11, "Provisioning signup membuat profile, personal workspace, owner membership & settings atomik", async () => {
      const UID_SIGNUP = "30000000-0000-4000-8000-000000000011";
      await signUpUser(UID_SIGNUP, "s@creatoros.id", "!"); // 1-char symbol edge case

      await withRoleContext(authPool, { role: "authenticated", userId: UID_SIGNUP }, async (c) => {
        const p = await c.query(`SELECT full_name FROM public.profiles WHERE id = $1`, [UID_SIGNUP]);
        assert.equal(p.rowCount, 1);
        assert.ok(p.rows[0].full_name.length >= 2);

        const w = await c.query(`SELECT id, slug FROM public.workspaces WHERE created_by = $1`, [UID_SIGNUP]);
        assert.equal(w.rowCount, 1);

        const m = await c.query(`SELECT role FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2`, [w.rows[0].id, UID_SIGNUP]);
        assert.equal(m.rowCount, 1);
        assert.equal(m.rows[0].role, "owner");

        const s = await c.query(`SELECT id FROM public.workspace_settings WHERE workspace_id = $1`, [w.rows[0].id]);
        assert.equal(s.rowCount, 1);
      });

      return "Signup provisioned all 4 tenant entities cleanly with sanitized display name & UUID slug";
    });

    // =========================================================================
    // TEST 12: Backfill Pengguna Lama (Termasuk Non-Owner Membership & Dirty Data)
    // =========================================================================
    await recordTest(12, "Backfill pengguna lama: memperbaiki non-owner user, orphan workspace, & dirty data tanpa menimpa profil", async () => {
      // Verify pre-migration dirty data (`UID_PRE_DIRTY` & `WS_PRE_DIRTY`) was sanitized & provisioned!
      const preDirtyCheck = await superPool.query(
        `SELECT p.full_name, p.preferred_language, p.theme_preference, w.name, w.slug, w.creator_mode
         FROM public.profiles p
         JOIN public.workspaces w ON w.id = $2
         WHERE p.id = $1`,
        [UID_PRE_DIRTY, WS_PRE_DIRTY]
      );
      assert.equal(preDirtyCheck.rowCount, 1);
      assert.equal(preDirtyCheck.rows[0].preferred_language, "id");
      assert.equal(preDirtyCheck.rows[0].theme_preference, "system");
      assert.equal(preDirtyCheck.rows[0].creator_mode, "creator");
      assert.match(preDirtyCheck.rows[0].slug, /^ws-[0-9a-f]{32}$/);

      // CRITICAL TEST (Audit Item 3): User who ONLY has a non-owner ('viewer') membership in Workspace A
      // MUST NOT be skipped by backfill — they MUST receive their own personal workspace as 'owner'!
      const UID_INVITED_ONLY = "40000000-0000-4000-8000-000000000010";
      const UID_CUSTOM_PROF = "40000000-0000-4000-8000-000000000011";
      const ORPHAN_WS_ID = "49999999-0000-4000-8000-000000000012";

      await signUpUser(UID_CUSTOM_PROF, "custom12@creatoros.id", "Original Name");
      await withRoleContext(authPool, { role: "authenticated", userId: UID_CUSTOM_PROF }, async (c) => {
        await c.query(`UPDATE public.profiles SET full_name = 'Edited Custom Name', theme_preference = 'dark' WHERE id = $1`, [UID_CUSTOM_PROF]);
      });

      // Seed legacy user who has ONLY a 'viewer' row in wsA (0 owned workspaces!) + an orphan workspace
      await superPool.query(`
        ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ('${UID_INVITED_ONLY}', 'invited.only@creatoros.id', '{"full_name": "Invited Viewer Only"}'::jsonb);
        ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

        ALTER TABLE public.workspace_members DISABLE TRIGGER trigger_workspace_member_safety;
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES ('${wsA}', '${UID_INVITED_ONLY}', 'viewer');
        ALTER TABLE public.workspace_members ENABLE TRIGGER trigger_workspace_member_safety;

        ALTER TABLE public.workspaces DISABLE TRIGGER on_workspace_created;
        INSERT INTO public.workspaces (id, name, slug, creator_mode, created_by)
        VALUES ('${ORPHAN_WS_ID}', 'Legacy Orphan 12', 'legacy-orphan-12', 'creator', '${UID_OWNER_A}');
        ALTER TABLE public.workspaces ENABLE TRIGGER on_workspace_created;
      `);

      // Re-run migration SQL TWICE!
      await superPool.query(migrationSql);
      await superPool.query(migrationSql);

      // 1) UID_INVITED_ONLY STILL has 'viewer' in wsA AND NOW OWNS their own personal workspace!
      const ownedByInvited = await superPool.query(
        `SELECT wm.workspace_id, wm.role FROM public.workspace_members wm WHERE wm.user_id = $1 AND wm.role = 'owner'`,
        [UID_INVITED_ONLY]
      );
      assert.equal(ownedByInvited.rowCount, 1, "Invited-only user MUST receive their own personal workspace as owner!");
      assert.notEqual(ownedByInvited.rows[0].workspace_id, wsA);

      const viewerStillIntact = await superPool.query(
        `SELECT role FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [wsA, UID_INVITED_ONLY]
      );
      assert.equal(viewerStillIntact.rows[0].role, "viewer");

      // 2) Custom profile was NOT overwritten & has 0 duplicate workspaces
      const customProf = await superPool.query(`SELECT full_name, theme_preference FROM public.profiles WHERE id = $1`, [UID_CUSTOM_PROF]);
      assert.equal(customProf.rows[0].full_name, "Edited Custom Name");
      assert.equal(customProf.rows[0].theme_preference, "dark");
      const customWsCnt = await superPool.query(`SELECT count(*)::int AS c FROM public.workspaces WHERE created_by = $1`, [UID_CUSTOM_PROF]);
      assert.equal(customWsCnt.rows[0].c, 1);

      // 3) Orphan workspace repaired
      const orphanOwner = await superPool.query(`SELECT role FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2`, [ORPHAN_WS_ID, UID_OWNER_A]);
      assert.equal(orphanOwner.rows[0].role, "owner");

      return "Non-owner member got personal owned workspace, dirty legacy rows sanitized before constraints, profile edits preserved";
    });

    // =========================================================================
    // TEST 13: Slug Collision Recovery
    // =========================================================================
    await recordTest(13, "Slug collision ditangani saat INSERT tanpa kegagalan diam-diam", async () => {
      const UID_COL = "50000000-0000-4000-8000-000000000013";
      const squatted = `slug-hero-${UID_COL.replace(/-/g, "").toLowerCase()}`;

      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        await c.query(
          `INSERT INTO public.workspaces (name, slug, creator_mode, created_by) VALUES ('Squat', $1, 'creator', $2)`,
          [squatted, UID_OWNER_A]
        );
      });

      await signUpUser(UID_COL, "col@creatoros.id", "Slug Hero");

      const allocatedSlug = await withRoleContext(authPool, { role: "authenticated", userId: UID_COL }, async (c) => {
        const w = await c.query(`SELECT id, slug FROM public.workspaces WHERE created_by = $1`, [UID_COL]);
        assert.equal(w.rowCount, 1);
        assert.notEqual(w.rows[0].slug, squatted);
        assert.match(w.rows[0].slug, /^slug-hero-[0-9a-f]{32}$/);
        return w.rows[0].slug;
      });

      return `Collided on '${squatted}' -> recovered with fresh 128-bit UUID slug '${allocatedSlug}'`;
    });

    // =========================================================================
    // TEST 14: Account Deletion Lifecycle (`auth.users`)
    // =========================================================================
    await recordTest(14, "Account deletion: blokir sole owner shared workspace, izinkan pasca-transfer & bersihkan personal workspace", async () => {
      const UID_FOUNDER = "60000000-0000-4000-8000-000000000001";
      const UID_SUCCESSOR = "60000000-0000-4000-8000-000000000002";
      const UID_SOLO = "60000000-0000-4000-8000-000000000003";

      await signUpUser(UID_FOUNDER, "founder@creatoros.id", "Founder User");
      await signUpUser(UID_SUCCESSOR, "successor@creatoros.id", "Successor User");
      await signUpUser(UID_SOLO, "solo@creatoros.id", "Solo User");

      // 14a. Solo user (only sole-member personal workspace) deletes account -> SUCCEEDS & cleans workspace!
      const soloWsRes = await superPool.query(`SELECT id FROM public.workspaces WHERE created_by = $1`, [UID_SOLO]);
      const soloWsId = soloWsRes.rows[0].id;
      await deleteAuthUser(UID_SOLO);
      assert.equal((await superPool.query(`SELECT 1 FROM public.workspaces WHERE id = $1`, [soloWsId])).rowCount, 0, "Personal sole-member workspace cleaned up");
      assert.equal((await superPool.query(`SELECT 1 FROM public.profiles WHERE id = $1`, [UID_SOLO])).rowCount, 0, "Profile cleaned up");

      // 14b. Founder creates a shared workspace with Successor, then tries to delete account BEFORE transfer -> BLOCKED!
      const sharedWsId = await withRoleContext(authPool, { role: "authenticated", userId: UID_FOUNDER }, async (c) => {
        const r = await c.query(
          `INSERT INTO public.workspaces (name, slug, creator_mode, created_by) VALUES ('Shared Venture', 'shared-venture-ws', 'business', $1) RETURNING id`,
          [UID_FOUNDER]
        );
        await c.query(`SELECT public.add_workspace_member($1, $2, 'admin')`, [r.rows[0].id, UID_SUCCESSOR]);
        return r.rows[0].id;
      });

      const eBlocked = await expectReject(
        () => deleteAuthUser(UID_FOUNDER),
        /Account deletion blocked: User .* is the sole remaining owner of shared workspace/i,
        "delete account while sole owner of shared workspace"
      );

      // 14c. Founder transfers shared workspace ownership to Successor -> account deletion NOW SUCCEEDS!
      await withRoleContext(authPool, { role: "authenticated", userId: UID_FOUNDER }, async (c) => {
        await c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [sharedWsId, UID_SUCCESSOR]);
      });

      await deleteAuthUser(UID_FOUNDER);

      // Verify shared workspace SURVIVED with `created_by IS NULL` and `UID_SUCCESSOR` as `owner`!
      const survivingWs = await superPool.query(`SELECT id, created_by FROM public.workspaces WHERE id = $1`, [sharedWsId]);
      assert.equal(survivingWs.rowCount, 1, "Shared workspace must survive creator account deletion");
      assert.equal(survivingWs.rows[0].created_by, null, "Surviving workspace created_by set to NULL via FK");

      const survivingOwner = await superPool.query(
        `SELECT role FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [sharedWsId, UID_SUCCESSOR]
      );
      assert.equal(survivingOwner.rows[0].role, "owner");

      return `Blocked before transfer (${eBlocked}); succeeded after transfer (shared WS survived with created_by=NULL, personal WS cleaned)`;
    });

    // =========================================================================
    // TEST 15: Workspace Cascade Deletion
    // =========================================================================
    await recordTest(15, "Workspace cascade deletion oleh owner membersihkan members, settings & locks; non-owner ditolak", async () => {
      const wsDelId = await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        const r = await c.query(
          `INSERT INTO public.workspaces (name, slug, creator_mode, created_by) VALUES ('Cascade Target', 'cascade-target-ws', 'creator', $1) RETURNING id`,
          [UID_OWNER_A]
        );
        await c.query(`SELECT public.add_workspace_member($1, $2, 'admin')`, [r.rows[0].id, UID_ADMIN_A]);
        return r.rows[0].id;
      });

      // Admin cannot DELETE workspace (0 rows affected under RLS `workspaces_delete_owner`)
      await withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, async (c) => {
        const d = await c.query(`DELETE FROM public.workspaces WHERE id = $1`, [wsDelId]);
        assert.equal(d.rowCount, 0, "Admin cannot delete workspace");
      });

      // Owner deletes workspace -> cascades cleanly!
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        const d = await c.query(`DELETE FROM public.workspaces WHERE id = $1`, [wsDelId]);
        assert.equal(d.rowCount, 1, "Owner deleted workspace");
      });

      assert.equal((await superPool.query(`SELECT 1 FROM public.workspace_members WHERE workspace_id = $1`, [wsDelId])).rowCount, 0);
      assert.equal((await superPool.query(`SELECT 1 FROM public.workspace_settings WHERE workspace_id = $1`, [wsDelId])).rowCount, 0);
      assert.equal((await superPool.query(`SELECT 1 FROM creatoros_internal.workspace_locks WHERE workspace_id = $1`, [wsDelId])).rowCount, 0);

      return "Admin DELETE rejected; Owner DELETE cascaded workspace_members, workspace_settings, and workspace_locks";
    });

    // =========================================================================
    // TEST 16: Service-Role Operations & auth.uid() Evaluation
    // =========================================================================
    await recordTest(16, "Service-role operations: read & workspace create diizinkan, direct DML & unauthenticated RPC ditolak", async () => {
      // 16a. service_role can SELECT across workspaces & create workspace for a valid user
      const srWsId = await withRoleContext(authPool, { role: "service_role", userId: null }, async (c) => {
        const allWs = await c.query(`SELECT count(*)::int AS cnt FROM public.workspaces`);
        assert.ok(allWs.rows[0].cnt >= 2);

        const ins = await c.query(
          `INSERT INTO public.workspaces (name, slug, creator_mode, created_by) VALUES ('SR Provisioned', 'sr-provisioned-ws', 'business', $1) RETURNING id`,
          [UID_OWNER_B]
        );
        return ins.rows[0].id;
      });

      // Verify trigger provisioned UID_OWNER_B as owner + settings
      const srOwner = await superPool.query(`SELECT role FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2`, [srWsId, UID_OWNER_B]);
      assert.equal(srOwner.rows[0].role, "owner");

      // 16b. service_role CANNOT directly INSERT/UPDATE/DELETE workspace_members
      await expectReject(
        () => withRoleContext(authPool, { role: "service_role", userId: null }, (c) =>
          c.query(`INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`, [srWsId, UID_OWNER_A])
        ),
        /permission denied for table workspace_members/i,
        "service_role direct INSERT workspace_members"
      );

      // 16c. service_role calling RPC without user JWT `sub` fails closed (`auth.uid() IS NULL`)
      await expectReject(
        () => withRoleContext(authPool, { role: "service_role", userId: null }, (c) =>
          c.query(`SELECT public.add_workspace_member($1, $2, 'member')`, [srWsId, UID_MEMBER_B])
        ),
        /Authentication required/i,
        "service_role RPC without sub"
      );

      // 16d. service_role WITH valid user JWT `sub` executes RPC with that user's exact RBAC permissions
      await withRoleContext(authPool, { role: "service_role", userId: UID_OWNER_B }, async (c) => {
        const mId = await c.query(`SELECT public.add_workspace_member($1, $2, 'editor') AS id`, [srWsId, UID_MEMBER_B]);
        assert.ok(mId.rows[0].id);
      });

      return "service_role SELECT & workspace creation work; direct member DML & sub-less RPC fail closed";
    });

    // =========================================================================
    // TEST 17: INSERT ... RETURNING dengan RLS pada public.workspaces
    // =========================================================================
    await recordTest(17, "INSERT ... RETURNING pada public.workspaces bersama RLS tanpa asumsi timing rapuh", async () => {
      // 17a. Authenticated user executes INSERT ... RETURNING * -> succeeds deterministically,
      // pending_workspace_inserts is cleared immediately in AFTER INSERT, and owner + settings exist!
      const retWs = await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        const r = await c.query(
          `INSERT INTO public.workspaces (name, slug, creator_mode, created_by)
           VALUES ('Returning Test', 'returning-rls-ws', 'creator', $1)
           RETURNING id, name, slug, created_by`,
          [UID_OWNER_A]
        );
        assert.equal(r.rowCount, 1);

        // Within the exact same transaction right after INSERT, caller is already a full owner!
        const access = await c.query(`SELECT public.has_workspace_access($1, 'owner') AS ok`, [r.rows[0].id]);
        assert.equal(access.rows[0].ok, true);

        // And `is_workspace_creator_during_insert` is already FALSE because AFTER INSERT cleared pending_workspace_inserts!
        const duringIns = await c.query(`SELECT public.is_workspace_creator_during_insert($1, $2) AS ok`, [r.rows[0].id, UID_OWNER_A]);
        assert.equal(duringIns.rows[0].ok, false, "Helper must return FALSE immediately after INSERT completes!");
        return r.rows[0].id;
      });

      const pendingCnt = await superPool.query(`SELECT count(*)::int AS c FROM creatoros_internal.pending_workspace_inserts`);
      assert.equal(pendingCnt.rows[0].c, 0, "pending_workspace_inserts must have 0 rows");

      // 17b. Prove no orphan-timing assumption: even if a historical workspace had 0 members in another tx,
      // `is_workspace_creator_during_insert` returns FALSE because `pending_workspace_inserts` has no xid8 entry!
      const fakeOrphanId = "77777777-0000-4000-8000-000000000017";
      await superPool.query(`
        ALTER TABLE public.workspaces DISABLE TRIGGER trigger_prepare_workspace_insert;
        ALTER TABLE public.workspaces DISABLE TRIGGER on_workspace_created;
        INSERT INTO public.workspaces (id, name, slug, creator_mode, created_by)
        VALUES ('${fakeOrphanId}', 'Zero Member Orphan', 'zero-member-orphan', 'creator', '${UID_OWNER_A}');
        ALTER TABLE public.workspaces ENABLE TRIGGER trigger_prepare_workspace_insert;
        ALTER TABLE public.workspaces ENABLE TRIGGER on_workspace_created;
      `);
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        const helperVal = await c.query(`SELECT public.is_workspace_creator_during_insert($1, $2) AS ok`, [fakeOrphanId, UID_OWNER_A]);
        assert.equal(helperVal.rows[0].ok, false, "Must NOT grant SELECT on historical 0-member row outside INSERT xid8!");
        const sel = await c.query(`SELECT * FROM public.workspaces WHERE id = $1`, [fakeOrphanId]);
        assert.equal(sel.rowCount, 0);
      });
      await superPool.query(`DELETE FROM public.workspaces WHERE id = $1`, [fakeOrphanId]);

      // 17c. Former creator who transfers ownership & leaves loses SELECT access completely
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        await c.query(`SELECT public.add_workspace_member($1, $2, 'member')`, [retWs, UID_OWNER_B]);
        await c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [retWs, UID_OWNER_B]);
        await c.query(`SELECT public.remove_workspace_member($1, $2)`, [retWs, UID_OWNER_A]);

        const selAfterLeave = await c.query(`SELECT * FROM public.workspaces WHERE id = $1`, [retWs]);
        assert.equal(selAfterLeave.rowCount, 0, "Former creator loses SELECT even inside the same transaction!");
      });

      return "INSERT ... RETURNING verified; helper FALSE post-insert & on historical orphans; former creator loses SELECT";
    });

    // =========================================================================
    // TEST 18: Concurrent Membership Mutations (Add, Update, Remove, Transfer)
    // =========================================================================
    await recordTest(18, "Concurrent membership mutations (paralel add, update, remove & transfer) bebas deadlock", async () => {
      const U_CONC_1 = "80000000-0000-4000-8000-000000000001";
      const U_CONC_2 = "80000000-0000-4000-8000-000000000002";
      const U_CONC_3 = "80000000-0000-4000-8000-000000000003";
      await signUpUser(U_CONC_1, "c1@creatoros.id", "Conc One");
      await signUpUser(U_CONC_2, "c2@creatoros.id", "Conc Two");
      await signUpUser(U_CONC_3, "c3@creatoros.id", "Conc Three");

      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        await c.query(`SELECT public.add_workspace_member($1, $2, 'member')`, [wsA, U_CONC_1]);
        await c.query(`SELECT public.add_workspace_member($1, $2, 'editor')`, [wsA, U_CONC_2]);
      });

      // Fire 6 concurrent membership mutations against wsA across separate connections simultaneously!
      const burst = await Promise.allSettled([
        withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.add_workspace_member($1, $2, 'viewer')`, [wsA, U_CONC_3])
        ),
        withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.update_workspace_member_role($1, $2, 'editor')`, [wsA, U_CONC_1])
        ),
        withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT public.update_workspace_member_role($1, $2, 'admin')`, [wsA, U_CONC_2])
        ),
        withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_ADMIN_A])
        ),
        withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, U_CONC_1])
        ),
        withRoleContext(authPool, { role: "authenticated", userId: U_CONC_2 }, (c) =>
          c.query(`SELECT public.remove_workspace_member($1, $2)`, [wsA, U_CONC_2])
        ),
      ]);

      const deadlocks = burst.filter((b) => b.status === "rejected" && /deadlock/i.test(b.reason?.message || ""));
      assert.equal(deadlocks.length, 0, "Zero 40P01 deadlocks during concurrent membership burst!");

      const ownersAfter = await superPool.query(
        `SELECT user_id FROM public.workspace_members WHERE workspace_id = $1 AND role = 'owner'`,
        [wsA]
      );
      assert.equal(ownersAfter.rowCount, 1, "Exactly 1 owner preserved after concurrent burst");

      // Restore UID_OWNER_A if ownership moved to UID_ADMIN_A
      if (ownersAfter.rows[0].user_id !== UID_OWNER_A) {
        await withRoleContext(authPool, { role: "authenticated", userId: ownersAfter.rows[0].user_id }, (c) =>
          c.query(`SELECT public.transfer_workspace_ownership($1, $2)`, [wsA, UID_OWNER_A])
        );
      }

      const lingeringTok = await superPool.query(`SELECT count(*)::int AS c FROM creatoros_internal.trusted_operations`);
      assert.equal(lingeringTok.rows[0].c, 0, "Zero lingering tokens after concurrent burst");

      return `6 parallel membership RPCs serialized cleanly via Level 1 -> Level 2 locks (0 deadlocks, 1 owner, 0 tokens)`;
    });

    // =========================================================================
    // TEST 19: Rollback Ketika Salah Satu Langkah Provisioning Gagal
    // =========================================================================
    await recordTest(19, "Rollback atomik penuh ketika salah satu langkah provisioning gagal", async () => {
      const UID_FAIL_PROV = "90000000-0000-4000-8000-000000000019";

      // Inject failure at the final provisioning step (`workspace_settings` INSERT)
      await superPool.query(`
        CREATE OR REPLACE FUNCTION creatoros_internal.zz_fail_settings_insert()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'Simulated workspace_settings provisioning failure';
        END;
        $$;
        CREATE TRIGGER zz_test_fail_settings
          BEFORE INSERT ON public.workspace_settings
          FOR EACH ROW EXECUTE FUNCTION creatoros_internal.zz_fail_settings_insert();
      `);

      try {
        await expectReject(
          () => signUpUser(UID_FAIL_PROV, "fail.prov@creatoros.id", "Fail Provisioning User"),
          /Simulated workspace_settings provisioning failure/i,
          "signup rollback on workspace_settings failure"
        );
      } finally {
        await superPool.query(`
          DROP TRIGGER IF EXISTS zz_test_fail_settings ON public.workspace_settings;
          DROP FUNCTION IF EXISTS creatoros_internal.zz_fail_settings_insert();
        `);
      }

      // Verify ZERO partial/orphan records remain in ANY table!
      assert.equal((await superPool.query(`SELECT 1 FROM auth.users WHERE id = $1`, [UID_FAIL_PROV])).rowCount, 0, "0 auth.users");
      assert.equal((await superPool.query(`SELECT 1 FROM public.profiles WHERE id = $1`, [UID_FAIL_PROV])).rowCount, 0, "0 profiles");
      assert.equal((await superPool.query(`SELECT 1 FROM public.workspaces WHERE created_by = $1`, [UID_FAIL_PROV])).rowCount, 0, "0 workspaces");
      assert.equal((await superPool.query(`SELECT 1 FROM public.workspace_members WHERE user_id = $1`, [UID_FAIL_PROV])).rowCount, 0, "0 workspace_members");
      assert.equal((await superPool.query(`SELECT 1 FROM creatoros_internal.trusted_operations`)).rowCount, 0, "0 trusted_operations");
      assert.equal((await superPool.query(`SELECT 1 FROM creatoros_internal.pending_workspace_inserts`)).rowCount, 0, "0 pending_workspace_inserts");

      return "Mid-provisioning failure rolled back auth.users, profiles, workspaces, members, settings & tokens 100%";
    });

    // =========================================================================
    // TEST 20: Residual Hardening (Soft-Delete Isolation, URL XSS Schemes, Reserved Slugs, Immutable Slug/Timestamps & Atomic Config RPC)
    // =========================================================================
    await recordTest(20, "Soft-delete isolation, URL XSS scheme block, reserved slug block, admin slug/deleted_at lock & atomic config RPC", async () => {
      // 20a. Stored XSS URL schemes (`javascript:` / `data:`) rejected on `profiles.avatar_url` and `workspaces.logo_url`
      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`UPDATE public.profiles SET avatar_url = 'javascript:alert(1)' WHERE id = $1`, [UID_OWNER_A])
        ),
        /check_profiles_avatar_url/i,
        "javascript: scheme on profiles.avatar_url"
      );

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`UPDATE public.workspaces SET logo_url = 'data:text/html,<script>alert(1)</script>' WHERE id = $1`, [wsA])
        ),
        /check_workspaces_logo_url/i,
        "data: scheme on workspaces.logo_url"
      );

      // Valid https:// URL succeeds
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        const ok = await c.query(`UPDATE public.profiles SET avatar_url = 'https://cdn.creatoros.id/avatar.png' WHERE id = $1`, [UID_OWNER_A]);
        assert.equal(ok.rowCount, 1);
      });

      // 20b. Reserved system slugs & malformed leading/trailing hyphens rejected
      for (const badSlug of ["admin", "api", "dashboard", "-bad-slug", "bad--slug"]) {
        await expectReject(
          () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
            c.query(`INSERT INTO public.workspaces (name, slug, creator_mode, created_by) VALUES ('Bad Slug', $1, 'creator', $2)`, [badSlug, UID_OWNER_A])
          ),
          /check_workspaces_slug/i,
          `reserved/malformed slug '${badSlug}'`
        );
      }

      // 20c. Admin blocked from mutating `workspaces.slug`, `workspaces.created_at`, or `workspaces.deleted_at`
      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`UPDATE public.workspaces SET slug = 'hijacked-by-admin' WHERE id = $1`, [wsA])
        ),
        /Only workspace owners can modify workspace slug/i,
        "admin mutating workspace slug"
      );

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`UPDATE public.workspaces SET created_at = '2020-01-01T00:00:00Z' WHERE id = $1`, [wsA])
        ),
        /created_at are immutable/i,
        "admin mutating workspace created_at"
      );

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.soft_delete_workspace($1)`, [wsA])
        ),
        /Only a workspace owner can archive or delete a workspace/i,
        "admin calling soft_delete_workspace"
      );

      // 20d. Atomic `update_workspace_configuration` RPC: editor rejected, admin succeeds atomically
      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_EDITOR_A }, (c) =>
          c.query(`SELECT public.update_workspace_configuration($1, 'Hacked Name', 'business', 'en', 'gpt-4o', false, false)`, [wsA])
        ),
        /Only workspace owners or admins can update workspace configuration/i,
        "editor calling update_workspace_configuration"
      );

      await withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, async (c) => {
        const res = await c.query(
          `SELECT public.update_workspace_configuration($1, 'Atomic Updated WS', 'business', 'en', 'gemini-1.5-pro', false, true) AS ok`,
          [wsA]
        );
        assert.equal(res.rows[0].ok, true);
      });

      const cfgCheck = await superPool.query(
        `SELECT w.name, w.creator_mode, s.default_language, s.default_ai_model, s.enable_auto_hashtag, s.notify_on_publish
         FROM public.workspaces w
         JOIN public.workspace_settings s ON s.workspace_id = w.id
         WHERE w.id = $1`,
        [wsA]
      );
      assert.equal(cfgCheck.rows[0].name, "Atomic Updated WS");
      assert.equal(cfgCheck.rows[0].creator_mode, "business");
      assert.equal(cfgCheck.rows[0].default_language, "en");
      assert.equal(cfgCheck.rows[0].default_ai_model, "gemini-1.5-pro");
      assert.equal(cfgCheck.rows[0].enable_auto_hashtag, false);
      assert.equal(cfgCheck.rows[0].notify_on_publish, true);

      // 20e. Soft-delete lifecycle: blocks archiving sole owned workspace; archives secondary workspace & isolates RLS + RPCs
      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_ADMIN_A }, (c) =>
          c.query(`SELECT public.soft_delete_workspace((SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = $1 AND wm.role = 'owner' LIMIT 1))`, [UID_ADMIN_A])
        ),
        /Cannot archive your only active owned workspace/i,
        "owner archiving sole active owned workspace"
      );

      const archWs = await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        const ins = await c.query(
          `INSERT INTO public.workspaces (name, slug, creator_mode, created_by)
           VALUES ('Temp Archive WS', 'temp-archive-ws-20', 'creator', $1)
           RETURNING id`,
          [UID_OWNER_A]
        );
        const id = ins.rows[0].id;
        await c.query(`SELECT public.add_workspace_member($1, $2, 'editor')`, [id, UID_EDITOR_A]);
        const ok = await c.query(`SELECT public.soft_delete_workspace($1) AS ok`, [id]);
        assert.equal(ok.rows[0].ok, true);
        return id;
      });

      // Verify RLS & RPCs completely hide/block the soft-deleted workspace
      await withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, async (c) => {
        assert.equal((await c.query(`SELECT 1 FROM public.workspaces WHERE id = $1`, [archWs])).rowCount, 0, "0 workspaces via RLS");
        assert.equal((await c.query(`SELECT 1 FROM public.workspace_members WHERE workspace_id = $1`, [archWs])).rowCount, 0, "0 members via RLS");
        assert.equal((await c.query(`SELECT 1 FROM public.workspace_settings WHERE workspace_id = $1`, [archWs])).rowCount, 0, "0 settings via RLS");
      });

      await expectReject(
        () => withRoleContext(authPool, { role: "authenticated", userId: UID_OWNER_A }, (c) =>
          c.query(`SELECT public.add_workspace_member($1, $2, 'viewer')`, [archWs, UID_VIEWER_A])
        ),
        /has been archived or deleted/i,
        "add_workspace_member on soft-deleted workspace"
      );

      return "XSS URL schemes, reserved slugs, admin slug/timestamp tampering blocked; atomic config & soft-delete isolation verified";
    });

    console.log(`\n=== SUMMARY: ALL ${results.length}/20 MANDATORY REAL POSTGRESQL TESTS PASSED ===`);
    fs.writeFileSync(path.join(process.cwd(), "audit_results.json"), JSON.stringify(results, null, 2));

    if (fs.existsSync(SQL_SUITE_PATH)) {
      console.log("\n=== EXECUTING STANDALONE SQL SUITE (supabase/tests/security_hardening_audit.sql) ===");
      const sqlSuite = fs.readFileSync(SQL_SUITE_PATH, "utf8");
      const sqlClient = await superPool.connect();
      try {
        sqlClient.on("notice", (msg) => console.log("[SQL NOTICE]", msg.message));
        await sqlClient.query(sqlSuite);
        console.log("=== STANDALONE SQL SUITE PASSED CLEANLY ===");
      } finally {
        sqlClient.release();
      }
    }
  } finally {
    if (authPool) await authPool.end().catch(() => {});
    await superPool.end().catch(() => {});
    await embeddedPg.stop().catch(() => {});
    await cleanDir(PG_DATA_DIR).catch(() => {});
  }
}

main().catch((err) => {
  console.error("FATAL TEST RUNNER ERROR:", err);
  process.exit(1);
});
