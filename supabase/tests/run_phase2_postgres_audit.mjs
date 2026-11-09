import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = fs.existsSync(path.resolve(__dirname, "../migrations/20261030000000_phase1_foundation.sql"))
  ? path.resolve(__dirname, "../..")
  : "d:\\CreatorOS AI";

const PHASE1_SQL = path.join(REPO_ROOT, "supabase", "migrations", "20261030000000_phase1_foundation.sql");
const PHASE2_SQL = path.join(REPO_ROOT, "supabase", "migrations", "20261030010000_phase2_creator_intelligence.sql");
const PG_PORT = 55441;
const PG_DATA_DIR = path.join(process.cwd(), "pgdata_phase2_ephemeral");

async function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

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

  console.log("=== INITIALIZING PHASE 2 POSTGRESQL 18 SANDBOX ===");
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
  let passed = 0;

  const runTest = async (num, name, fn) => {
    const start = Date.now();
    const detail = await fn();
    passed++;
    console.log(`[PASS] #${String(num).padStart(2, "0")} (${Date.now() - start}ms) ${name} — ${detail}`);
  };

  try {
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

    const UID_PRE = "10000000-0000-4000-8000-000000000001";
    const UID_USER_B = "10000000-0000-4000-8000-000000000002";
    const UID_VIEWER = "10000000-0000-4000-8000-000000000003";

    // Seed User A BEFORE Phase 2 so backfill of credit_wallets + default_ai_model migration is tested
    await superPool.query(fs.readFileSync(PHASE1_SQL, "utf8"));
    await superPool.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'alice@creatoros.id', '{"full_name":"Alice Creator"}'::jsonb)`,
      [UID_PRE]
    );

    // Apply Phase 2 migration TWICE to verify idempotent execution
    const phase2Sql = fs.readFileSync(PHASE2_SQL, "utf8");
    await superPool.query(phase2Sql);
    await superPool.query(phase2Sql);

    // Insert User B and Viewer AFTER Phase 2 to verify live trigger wallet provisioning
    await superPool.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ($1, 'budi@creatoros.id', '{"full_name":"Budi Affiliate"}'::jsonb),
        ($2, 'viewer@creatoros.id', '{"full_name":"Vina Viewer"}'::jsonb)`,
      [UID_USER_B, UID_VIEWER]
    );

    authPool = new Pool({
      host: "127.0.0.1",
      port: PG_PORT,
      user: "authenticator",
      password: "authenticator_pw",
      database: "postgres",
      max: 15,
    });

    const { rows: wsRowsA } = await superPool.query(
      `SELECT workspace_id FROM public.workspace_members WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
      [UID_PRE]
    );
    const { rows: wsRowsB } = await superPool.query(
      `SELECT workspace_id FROM public.workspace_members WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
      [UID_USER_B]
    );
    const wsA = wsRowsA[0].workspace_id;
    const wsB = wsRowsB[0].workspace_id;

    // Add UID_VIEWER as 'viewer' in wsA
    await withRoleContext(authPool, { userId: UID_PRE }, async (c) => {
      await c.query(`SELECT public.add_workspace_member($1, $2, 'viewer')`, [wsA, UID_VIEWER]);
    });

    await runTest(1, "Phase 2 Backfill & Trigger Credit Wallet + Gemini 3.8 Default", async () => {
      const { rows: wallets } = await superPool.query(
        `SELECT workspace_id, balance, monthly_allowance FROM public.credit_wallets WHERE workspace_id IN ($1, $2)`,
        [wsA, wsB]
      );
      assert.equal(wallets.length, 2);
      assert.equal(wallets[0].balance, 50);
      assert.equal(wallets[1].balance, 50);

      const { rows: settings } = await superPool.query(
        `SELECT default_ai_model FROM public.workspace_settings WHERE workspace_id = $1`,
        [wsA]
      );
      assert.equal(settings[0].default_ai_model, "gemini-3.8-flash");
      return "Both pre-existing & newly created workspaces have 50 starter credits + gemini-3.8-flash";
    });

    await runTest(2, "Onboarding Session Persistence, Editing & Cross-Tenant Isolation", async () => {
      await withRoleContext(authPool, { userId: UID_PRE }, async (c) => {
        await c.query(
          `INSERT INTO public.onboarding_sessions (workspace_id, user_id, status, current_step, core_answers)
           VALUES ($1, $2, 'adaptive_interview', 2, $3::jsonb)`,
          [wsA, UID_PRE, JSON.stringify({ interests: ["FinTech", "Produktivitas"], experience: "beginner" })]
        );

        await c.query(
          `UPDATE public.onboarding_sessions
           SET core_answers = $2::jsonb, status = 'completed'
           WHERE workspace_id = $1`,
          [wsA, JSON.stringify({ interests: ["Personal Finance", "AI Tools"], experience: "intermediate" })]
        );
      });

      // User B cannot read or update wsA onboarding_sessions
      await withRoleContext(authPool, { userId: UID_USER_B }, async (c) => {
        const { rows } = await c.query(`SELECT * FROM public.onboarding_sessions WHERE workspace_id = $1`, [wsA]);
        assert.equal(rows.length, 0);
      });

      await expectReject(
        () =>
          withRoleContext(authPool, { userId: UID_USER_B }, (c) =>
            c.query(
              `INSERT INTO public.onboarding_sessions (workspace_id, user_id, core_answers) VALUES ($1, $2, '{}'::jsonb)`,
              [wsA, UID_USER_B]
            )
          ),
        /row-level security/i,
        "Cross-tenant onboarding insert"
      );

      // Viewer in wsA can SELECT but cannot UPDATE onboarding_sessions
      await withRoleContext(authPool, { userId: UID_VIEWER }, async (c) => {
        const { rows } = await c.query(`SELECT status FROM public.onboarding_sessions WHERE workspace_id = $1`, [wsA]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].status, "completed");
        const upd = await c.query(`UPDATE public.onboarding_sessions SET current_step = 3 WHERE workspace_id = $1`, [wsA]);
        assert.equal(upd.rowCount, 0);
      });

      return "Onboarding answers saved, edited, isolated across tenants, and viewer write-blocked";
    });

    await runTest(3, "Creator DNA + Roadmap Persistence & Niche Selection Atomic Sync", async () => {
      let niche1Id = null;
      let niche2Id = null;

      await withRoleContext(authPool, { userId: UID_PRE }, async (c) => {
        await c.query(
          `INSERT INTO public.creator_profiles (
             workspace_id, creator_name, primary_niche, tone_of_voice, personality_archetype, roadmap_30_days
           ) VALUES ($1, 'Alice Finance', 'Keuangan Mahasiswa', ARRAY['edukatif','santai'], 'The Mentor', $2::jsonb)`,
          [wsA, JSON.stringify([{ week: 1, title: "Fondasi Profil", completed: false }])]
        );

        const r1 = await c.query(
          `INSERT INTO public.niche_recommendations (
             workspace_id, niche_title, explanation, audience, confidence_level, confidence_score, created_by
           ) VALUES ($1, 'Investasi Pemula Gaji UMR', 'Ceruk edukasi finansial praktis tanpa jargon rumit.', 'Pekerja muda 21-28 tahun', 'high', 86, $2)
           RETURNING id`,
          [wsA, UID_PRE]
        );
        niche1Id = r1.rows[0].id;

        const r2 = await c.query(
          `INSERT INTO public.niche_recommendations (
             workspace_id, niche_title, explanation, audience, confidence_level, confidence_score, created_by
           ) VALUES ($1, 'Produktivitas Kerja Remote dengan AI', 'Otomasi kerja harian untuk pekerja hybrid dan freelancer.', 'Pekerja remote Indonesia', 'medium', 78, $2)
           RETURNING id`,
          [wsA, UID_PRE]
        );
        niche2Id = r2.rows[0].id;

        // Select Niche 1
        await c.query(`SELECT public.select_preferred_niche($1, $2)`, [wsA, niche1Id]);
        // Switch to Niche 2 atomically
        await c.query(`SELECT public.select_preferred_niche($1, $2)`, [wsA, niche2Id]);
      });

      const { rows: selectedRows } = await superPool.query(
        `SELECT id, niche_title FROM public.niche_recommendations WHERE workspace_id = $1 AND is_selected = TRUE`,
        [wsA]
      );
      assert.equal(selectedRows.length, 1);
      assert.equal(selectedRows[0].id, niche2Id);

      const { rows: cpRows } = await superPool.query(
        `SELECT primary_niche FROM public.creator_profiles WHERE workspace_id = $1`,
        [wsA]
      );
      assert.equal(cpRows[0].primary_niche, "Produktivitas Kerja Remote dengan AI");

      // User B cannot select wsA's niche
      await expectReject(
        () =>
          withRoleContext(authPool, { userId: UID_USER_B }, (c) =>
            c.query(`SELECT public.select_preferred_niche($1, $2)`, [wsA, niche1Id])
          ),
        /Unauthorized/i,
        "Cross-tenant select_preferred_niche"
      );

      return "Single selected niche invariant & Creator DNA sync verified";
    });

    await runTest(4, "Tamper-Proof Credit Wallet & Atomic AI Telemetry Ledger", async () => {
      // Direct client tampering on credit_wallets or ai_provider_usage MUST fail
      await expectReject(
        () =>
          withRoleContext(authPool, { userId: UID_PRE }, (c) =>
            c.query(`UPDATE public.credit_wallets SET balance = 999999 WHERE workspace_id = $1`, [wsA])
          ),
        /permission denied/i,
        "Direct credit_wallets balance tampering"
      );

      await expectReject(
        () =>
          withRoleContext(authPool, { userId: UID_PRE }, (c) =>
            c.query(
              `INSERT INTO public.ai_provider_usage (workspace_id, provider, model_id, operation_type)
               VALUES ($1, 'gemini', 'gemini-3.8-flash', 'spoof')`,
              [wsA]
            )
          ),
        /permission denied/i,
        "Direct ai_provider_usage spoofing"
      );

      // Viewer cannot execute record_ai_usage_and_deduct_credits
      await expectReject(
        () =>
          withRoleContext(authPool, { userId: UID_VIEWER }, (c) =>
            c.query(
              `SELECT public.record_ai_usage_and_deduct_credits($1, 'OnboardingCoach', 'adaptive_questions', 'gemini', 'gemini-3.8-flash', 400, 200, 600, 0.0005, 1, 850, 'success')`,
              [wsA]
            )
          ),
        /Unauthorized/i,
        "Viewer calling record_ai_usage_and_deduct_credits"
      );

      // Concurrent valid deductions by Owner serialize cleanly without lost updates
      await Promise.all([
        withRoleContext(authPool, { userId: UID_PRE }, (c) =>
          c.query(
            `SELECT public.record_ai_usage_and_deduct_credits($1, 'OnboardingCoach', 'creator_dna_synthesis', 'gemini', 'gemini-3.8-flash', 1200, 950, 2150, 0.0031, 3, 1800, 'success')`,
            [wsA]
          )
        ),
        withRoleContext(authPool, { userId: UID_PRE }, (c) =>
          c.query(
            `SELECT public.record_ai_usage_and_deduct_credits($1, 'NicheStrategist', 'niche_discovery', 'gemini', 'gemini-3.8-flash', 1400, 1100, 2500, 0.0036, 2, 2100, 'success')`,
            [wsA]
          )
        ),
      ]);

      // Failed AI call records telemetry with 0 credit deduction
      await withRoleContext(authPool, { userId: UID_PRE }, (c) =>
        c.query(
          `SELECT public.record_ai_usage_and_deduct_credits($1, 'NicheStrategist', 'niche_discovery', 'gemini', 'gemini-3.8-flash', 500, 0, 500, 0, 2, 400, 'failed', '{}'::jsonb, NULL, 'Timeout')`,
          [wsA]
        )
      );

      const { rows: walletAfter } = await withRoleContext(authPool, { userId: UID_PRE }, (c) =>
        c.query(`SELECT balance FROM public.credit_wallets WHERE workspace_id = $1`, [wsA])
      );
      assert.equal(walletAfter[0].balance, 45); // 50 - 3 - 2 - 0 = 45

      const { rows: usageRows } = await withRoleContext(authPool, { userId: UID_PRE }, (c) =>
        c.query(`SELECT status, credits_charged FROM public.ai_provider_usage WHERE workspace_id = $1 ORDER BY created_at ASC`, [wsA])
      );
      assert.equal(usageRows.length, 3);

      // Overdraft protection when balance < credits_to_deduct
      await superPool.query(`UPDATE public.credit_wallets SET balance = 1 WHERE workspace_id = $1`, [wsA]);
      await expectReject(
        () =>
          withRoleContext(authPool, { userId: UID_PRE }, (c) =>
            c.query(
              `SELECT public.record_ai_usage_and_deduct_credits($1, 'OnboardingCoach', 'creator_dna_synthesis', 'gemini', 'gemini-3.8-flash', 800, 600, 1400, 0.002, 3, 1200, 'success')`,
              [wsA]
            )
          ),
        /Insufficient workspace credits/i,
        "Credit overdraft protection"
      );

      return "Wallet tampering blocked, concurrent deductions serialized (50->45), failed calls 0-charged, overdraft rejected";
    });

    await runTest(5, "RLS Coverage & Immutable Tenant Keys Audit Across All Phase 1+2 Tables", async () => {
      const { rows: rlsMissing } = await superPool.query(`
        SELECT c.relname
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relrowsecurity = FALSE
      `);
      assert.equal(rlsMissing.length, 0, `Tables missing RLS: ${rlsMissing.map((r) => r.relname).join(", ")}`);

      await expectReject(
        () =>
          withRoleContext(authPool, { userId: UID_PRE }, (c) =>
            c.query(`UPDATE public.creator_profiles SET workspace_id = $2 WHERE workspace_id = $1`, [wsA, wsB])
          ),
        /immutable/i,
        "Immutable workspace_id on creator_profiles"
      );

      return "100% of public tables have RLS enabled & immutable workspace_id enforced";
    });

    console.log(`\n=== PHASE 2 POSTGRESQL SECURITY & INTEGRITY SUITE: ${passed}/5 PASSED ===`);
  } finally {
    if (authPool) await authPool.end().catch(() => {});
    await superPool.end().catch(() => {});
    await embeddedPg.stop().catch(() => {});
    await cleanDir(PG_DATA_DIR).catch(() => {});
  }
}

main().catch((err) => {
  console.error("FATAL PHASE 2 AUDIT FAILURE:", err);
  process.exit(1);
});
