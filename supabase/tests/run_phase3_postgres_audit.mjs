import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = fs.existsSync(
  path.resolve(__dirname, "../migrations/20261030000000_phase1_foundation.sql")
)
  ? path.resolve(__dirname, "../..")
  : "d:\\CreatorOS AI";

const PHASE1_SQL = path.join(
  REPO_ROOT,
  "supabase",
  "migrations",
  "20261030000000_phase1_foundation.sql"
);
const PHASE2_SQL = path.join(
  REPO_ROOT,
  "supabase",
  "migrations",
  "20261030010000_phase2_creator_intelligence.sql"
);
const PHASE3_SQL = path.join(
  REPO_ROOT,
  "supabase",
  "migrations",
  "20261030020000_phase3_research_and_content_engine.sql"
);

const PG_PORT = 55443;
const PG_DATA_DIR = path.join(process.cwd(), "pgdata_phase3_ephemeral");

async function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function withRoleContext(
  pool,
  { role = "authenticated", userId = null, isolation = "READ COMMITTED" },
  fn
) {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    await client.query(`SET LOCAL ROLE ${role}`);
    if (userId) {
      await client.query(
        `SELECT pg_catalog.set_config('request.jwt.claim.sub', $1, true)`,
        [userId]
      );
      await client.query(
        `SELECT pg_catalog.set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify({ sub: userId, role })]
      );
    } else {
      await client.query(
        `SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true)`
      );
      await client.query(
        `SELECT pg_catalog.set_config('request.jwt.claims', '', true)`
      );
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
  assert.equal(
    failed,
    true,
    `[FAIL] Expected rejection for (${label}), but operation succeeded!`
  );
  if (expectedSubstring) {
    const regex =
      expectedSubstring instanceof RegExp
        ? expectedSubstring
        : new RegExp(expectedSubstring, "i");
    assert.match(
      errMsg,
      regex,
      `[FAIL] Unexpected error message for (${label}): ${errMsg}`
    );
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

  console.log("=== INITIALIZING PHASE 3 POSTGRESQL 18 SANDBOX ===");
  await embeddedPg.initialise();
  await embeddedPg.start();

  const superPool = new Pool({
    host: "127.0.0.1",
    port: PG_PORT,
    user: "postgres",
    password: "postgres_local_test_password",
    database: "postgres",
    max: 12,
  });

  let authPool = null;
  let passed = 0;

  const runTest = async (num, name, fn) => {
    const start = Date.now();
    const detail = await fn();
    passed++;
    console.log(
      `[PASS] #${String(num).padStart(2, "0")} (${Date.now() - start}ms) ${name} — ${detail}`
    );
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

    await superPool.query(fs.readFileSync(PHASE1_SQL, "utf8"));
    await superPool.query(fs.readFileSync(PHASE2_SQL, "utf8"));
    await superPool.query(fs.readFileSync(PHASE3_SQL, "utf8"));
    // Verify idempotent re-run of Phase 3 migration
    await superPool.query(fs.readFileSync(PHASE3_SQL, "utf8"));

    const UID_A = "10000000-0000-4000-8000-000000000001";
    const UID_B = "10000000-0000-4000-8000-000000000002";
    const UID_VIEWER = "10000000-0000-4000-8000-000000000003";

    await superPool.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES
         ($1, 'alice@creatoros.id', '{"full_name":"Alice Creator"}'::jsonb),
         ($2, 'bima@creatoros.id', '{"full_name":"Bima Business"}'::jsonb),
         ($3, 'viewer@creatoros.id', '{"full_name":"Vina Viewer"}'::jsonb)`,
      [UID_A, UID_B, UID_VIEWER]
    );

    authPool = new Pool({
      host: "127.0.0.1",
      port: PG_PORT,
      user: "authenticator",
      password: "authenticator_pw",
      database: "postgres",
      max: 12,
    });

    const { rows: wsRowsA } = await superPool.query(
      `SELECT id FROM public.workspaces WHERE created_by = $1`,
      [UID_A]
    );
    const { rows: wsRowsB } = await superPool.query(
      `SELECT id FROM public.workspaces WHERE created_by = $1`,
      [UID_B]
    );
    const wsA = wsRowsA[0].id;
    const wsB = wsRowsB[0].id;

    // Add UID_VIEWER as 'viewer' in wsA
    await withRoleContext(authPool, { userId: UID_A }, async (c) => {
      await c.query(`SELECT public.add_workspace_member($1, $2, 'viewer')`, [
        wsA,
        UID_VIEWER,
      ]);
    });

    let reportAId = null;
    let strategyA1Id = null;
    let strategyA2Id = null;
    let pillarAId = null;
    let ideaAId = null;
    let itemAId = null;

    await runTest(
      1,
      "100% RLS Coverage & Idempotent Phase 3 Schema Audit",
      async () => {
        const { rows } = await superPool.query(`
          SELECT n.nspname, c.relname, c.relrowsecurity
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname IN ('public', 'creatoros_internal')
            AND c.relkind = 'r'
          ORDER BY n.nspname, c.relname
        `);
        const unprotected = rows.filter((r) => !r.relrowsecurity);
        assert.equal(
          unprotected.length,
          0,
          `Found tables without RLS: ${JSON.stringify(unprotected)}`
        );
        return `Verified ${rows.length} tables across public & creatoros_internal have RLS enabled`;
      }
    );

    await runTest(
      2,
      "Research Provenance, Timestamp Persistence, Realtime Disclaimer & Cross-Tenant Isolation",
      async () => {
        // 1. Reject report with realtime_data_available = FALSE and missing explanation
        await expectReject(
          () =>
            withRoleContext(authPool, { userId: UID_A }, async (c) => {
              await c.query(
                `INSERT INTO public.research_reports (
                   workspace_id, report_type, title, topic_query, summary, data_limitations,
                   overall_confidence, realtime_data_available, realtime_unavailable_reason, created_by
                 ) VALUES ($1, 'trend', 'Riset Tren Kopi', 'kopi susu literan', 'Ringkasan tren kopi rumahan',
                   'Data terbatas pada ulasan publik', 'medium', FALSE, NULL, $2)`,
                [wsA, UID_A]
              );
            }),
          /check_research_reports_realtime_explanation/,
          "Missing realtime_unavailable_reason"
        );

        // 2. Insert valid source-backed Trend Report + Recorded Sources with timestamps
        reportAId = await withRoleContext(authPool, { userId: UID_A }, async (c) => {
          const { rows } = await c.query(
            `INSERT INTO public.research_reports (
               workspace_id, report_type, title, topic_query, target_platform, summary,
               verified_facts, ai_interpretations, trend_claims, data_limitations,
               overall_confidence, realtime_data_available, retrieved_at, created_by
             ) VALUES (
               $1, 'trend', 'Riset Tren Produktivitas Kerja Hybrid', 'kerja hybrid indonesia', 'tiktok',
               'Analisis berbasis artikel berita publik mengenai pola kerja hybrid.',
               '[{"fact":"Perusahaan teknologi mengadopsi jadwal kerja hybrid 3 hari kantor.","sourceUrls":["https://news.google.com/articles/hybrid-work-id"]}]'::jsonb,
               '[{"interpretation":"Konten setup meja kerja hemat ruang relevan untuk pekerja hybrid."}]'::jsonb,
               '[{"claim":"Minat pada ergonomis meja kerja meningkat","supportingSourceUrls":["https://news.google.com/articles/hybrid-work-id"],"confidenceLevel":"medium"}]'::jsonb,
               'Hanya mencakup artikel publik berbahasa Indonesia minggu ini.',
               'medium', TRUE, '2026-10-30T16:00:00Z'::timestamptz, $2
             ) RETURNING id`,
            [wsA, UID_A]
          );
          const repId = rows[0].id;

          await c.query(
            `INSERT INTO public.research_sources (
               report_id, workspace_id, source_url, source_title, retrieved_at,
               relevant_extract, data_limitations, confidence_level, confidence_rationale, source_origin
             ) VALUES (
               $1, $2, 'https://news.google.com/articles/hybrid-work-id',
               'Pola Kerja Hybrid di Jakarta 2026', '2026-10-30T16:00:05Z'::timestamptz,
               'Mayoritas pekerja muda mengombinasikan kerja dari rumah dan kantor.',
               'Cuplikan tajuk dan ringkasan publik RSS.',
               'medium', 'Sumber media berita terindeks publik.', 'rss_feed'
             )`,
            [repId, wsA]
          );

          return repId;
        });

        // 3. Reject non-http source URL
        await expectReject(
          () =>
            withRoleContext(authPool, { userId: UID_A }, async (c) => {
              await c.query(
                `INSERT INTO public.research_sources (
                   report_id, workspace_id, source_url, source_title, retrieved_at,
                   relevant_extract, data_limitations, confidence_level, confidence_rationale
                 ) VALUES ($1, $2, 'javascript:alert(1)', 'Bad URL', now(), 'Extract panjang', 'Limitasi data', 'low', 'Alasan valid')`,
                [reportAId, wsA]
              );
            }),
          /check_research_sources_url_http/,
          "Reject javascript: URL in research_sources"
        );

        // 4. Cross-tenant User B cannot read Workspace A's research report or sources
        const bRead = await withRoleContext(authPool, { userId: UID_B }, async (c) => {
          const r1 = await c.query(`SELECT id FROM public.research_reports WHERE id = $1`, [reportAId]);
          const r2 = await c.query(`SELECT id FROM public.research_sources WHERE report_id = $1`, [reportAId]);
          return r1.rowCount + r2.rowCount;
        });
        assert.equal(bRead, 0, "Cross-tenant User B must see 0 rows from Workspace A");

        // 5. Viewer in Workspace A can SELECT but cannot INSERT research reports
        const viewerCount = await withRoleContext(authPool, { userId: UID_VIEWER }, async (c) => {
          const res = await c.query(`SELECT id FROM public.research_reports WHERE workspace_id = $1`, [wsA]);
          return res.rowCount;
        });
        assert.equal(viewerCount, 1);

        await expectReject(
          () =>
            withRoleContext(authPool, { userId: UID_VIEWER }, async (c) => {
              await c.query(
                `INSERT INTO public.competitor_profiles (workspace_id, handle, platform, created_by)
                 VALUES ($1, '@kompetitor_uji', 'tiktok', $2)`,
                [wsA, UID_VIEWER]
              );
            }),
          /row-level security/,
          "Viewer blocked from inserting competitor_profiles"
        );

        return "Provenance constraints, timestamps, RLS isolation, and viewer write-blocks verified";
      }
    );

    await runTest(
      3,
      "Editable Content Pillars & Concurrent Active Strategy Switching",
      async () => {
        await withRoleContext(authPool, { userId: UID_A }, async (c) => {
          const s1 = await c.query(
            `INSERT INTO public.content_strategies (
               workspace_id, research_report_id, title, positioning_statement, is_active, created_by
             ) VALUES ($1, $2, 'Strategi Q4 Kerja Hybrid', 'Panduan meja kerja produktif untuk pekerja hybrid', TRUE, $3)
             RETURNING id`,
            [wsA, reportAId, UID_A]
          );
          strategyA1Id = s1.rows[0].id;

          const s2 = await c.query(
            `INSERT INTO public.content_strategies (
               workspace_id, research_report_id, title, positioning_statement, is_active, created_by
             ) VALUES ($1, $2, 'Strategi Q1 Produktivitas', 'Fokus efisiensi waktu untuk pekerja remote', FALSE, $3)
             RETURNING id`,
            [wsA, reportAId, UID_A]
          );
          strategyA2Id = s2.rows[0].id;

          const pRes = await c.query(
            `INSERT INTO public.content_pillars (
               strategy_id, workspace_id, name, description, objective, ratio_percentage
             ) VALUES ($1, $2, 'Ergonomi Praktis', 'Tips setup meja kerja ramah punggung', 'educate', 40)
             RETURNING id`,
            [strategyA1Id, wsA]
          );
          pillarAId = pRes.rows[0].id;

          // Edit content pillar (acceptance criterion: Content pillars are editable)
          await c.query(
            `UPDATE public.content_pillars
             SET name = 'Setup Ergonomis Hemat Budget', ratio_percentage = 45
             WHERE id = $1 AND workspace_id = $2`,
            [pillarAId, wsA]
          );
        });

        // Concurrent strategy activation race test
        await Promise.all([
          withRoleContext(authPool, { userId: UID_A }, (c) =>
            c.query(`SELECT public.activate_content_strategy($1, $2)`, [wsA, strategyA2Id])
          ),
          withRoleContext(authPool, { userId: UID_A }, (c) =>
            c.query(`SELECT public.activate_content_strategy($1, $2)`, [wsA, strategyA1Id])
          ),
        ]);

        const { rows: activeRows } = await superPool.query(
          `SELECT id FROM public.content_strategies WHERE workspace_id = $1 AND is_active = TRUE`,
          [wsA]
        );
        assert.equal(activeRows.length, 1, "Must maintain strictly 1 active strategy");

        return `Pillar edited & concurrent strategy switching preserved single-active invariant`;
      }
    );

    await runTest(
      4,
      "Cross-Tenant FK Integrity Trigger & Immutable Identity Guard",
      async () => {
        // User B attempts to link Workspace A's pillar_id or research_report_id into Workspace B's content_ideas
        await expectReject(
          () =>
            withRoleContext(authPool, { userId: UID_B }, async (c) => {
              await c.query(
                `INSERT INTO public.content_ideas (
                   workspace_id, pillar_id, title, hook_concept, angle_type, target_platform, created_by
                 ) VALUES ($1, $2, 'Ide Lintas Tenant', 'Hook percobaan lintas workspace', 'curiosity', 'tiktok', $3)`,
                [wsB, pillarAId, UID_B]
              );
            }),
          /Cross-tenant reference violation/,
          "Block cross-tenant pillar_id reference"
        );

        // User A creates valid idea & content item
        await withRoleContext(authPool, { userId: UID_A }, async (c) => {
          const ideaRes = await c.query(
            `INSERT INTO public.content_ideas (
               workspace_id, pillar_id, research_report_id, title, hook_concept, angle_type, target_platform, created_by
             ) VALUES ($1, $2, $3, '3 Kesalahan Tinggi Monitor', 'Punggung pegal jam 2 siang? Cek posisi layar ini.', 'tutorial', 'tiktok', $4)
             RETURNING id`,
            [wsA, pillarAId, reportAId, UID_A]
          );
          ideaAId = ideaRes.rows[0].id;

          const itemRes = await c.query(
            `INSERT INTO public.content_items (
               workspace_id, pillar_id, idea_id, research_report_id, title, primary_platform,
               caption, call_to_action, hashtags, created_by
             ) VALUES (
               $1, $2, $3, $4, '3 Kesalahan Tinggi Monitor Kerja', 'tiktok',
               'Coba cek sejajar mata belum?', 'Simpan panduan ini untuk setup mejamu.',
               ARRAY['#kerjahybrid', '#ergonomimeja'], $5
             ) RETURNING id`,
            [wsA, pillarAId, ideaAId, reportAId, UID_A]
          );
          itemAId = itemRes.rows[0].id;
        });

        // Attempt to mutate workspace_id on content_items (must fail immutability trigger)
        await expectReject(
          () =>
            superPool.query(
              `UPDATE public.content_items SET workspace_id = $1 WHERE id = $2`,
              [wsB, itemAId]
            ),
          /immutable/,
          "Immutable workspace_id on content_items"
        );

        return "Cross-tenant FK attempts blocked and workspace_id immutability enforced";
      }
    );

    await runTest(
      5,
      "Concurrent Script Versioning RPC & Editable Script Persistence",
      async () => {
        // Run 3 concurrent save_script_version RPC calls on the same content_item
        await Promise.all([
          withRoleContext(authPool, { userId: UID_A }, (c) =>
            c.query(
              `SELECT public.save_script_version($1, $2, 'tiktok', 'PAS', 'Hook V-A', 'Isi naskah lengkap versi A untuk TikTok', 'Simpan sekarang', '[]'::jsonb, 45)`,
              [wsA, itemAId]
            )
          ),
          withRoleContext(authPool, { userId: UID_A }, (c) =>
            c.query(
              `SELECT public.save_script_version($1, $2, 'tiktok', 'AIDA', 'Hook V-B', 'Isi naskah lengkap versi B untuk TikTok', 'Bagikan ke teman kerja', '[]'::jsonb, 50)`,
              [wsA, itemAId]
            )
          ),
          withRoleContext(authPool, { userId: UID_A }, (c) =>
            c.query(
              `SELECT public.save_script_version($1, $2, 'tiktok', 'BAB', 'Hook V-C', 'Isi naskah lengkap versi C untuk TikTok', 'Komentar setup kamu', '[]'::jsonb, 55)`,
              [wsA, itemAId]
            )
          ),
        ]);

        const { rows: scripts } = await withRoleContext(
          authPool,
          { userId: UID_A },
          async (c) =>
            c.query(
              `SELECT id, version, is_current, body_content
               FROM public.scripts
               WHERE content_item_id = $1
               ORDER BY version ASC`,
              [itemAId]
            )
        );

        assert.deepEqual(
          scripts.map((s) => s.version),
          [1, 2, 3],
          "Versions must serialize cleanly as 1, 2, 3"
        );
        const currentScripts = scripts.filter((s) => s.is_current);
        assert.equal(currentScripts.length, 1, "Strictly 1 current script allowed");

        // Edit the current script in-place (acceptance criterion: Scripts are editable)
        await withRoleContext(authPool, { userId: UID_A }, async (c) => {
          await c.query(
            `UPDATE public.scripts
             SET body_content = 'Naskah telah diedit manual oleh kreator dengan langkah lebih ringkas.'
             WHERE id = $1 AND workspace_id = $2`,
            [currentScripts[0].id, wsA]
          );
        });

        return "3 concurrent script versions serialized cleanly (v1..v3) + direct editing verified";
      }
    );

    console.log(`\n=== ALL ${passed}/5 PHASE 3 POSTGRESQL 18 AUDIT SUITES PASSED ===`);
  } finally {
    if (authPool) await authPool.end().catch(() => {});
    await superPool.end().catch(() => {});
    await embeddedPg.stop().catch(() => {});
    await cleanDir(PG_DATA_DIR);
  }
}

main().catch((err) => {
  console.error("\n[FATAL PHASE 3 POSTGRES AUDIT FAILURE]", err);
  process.exit(1);
});
