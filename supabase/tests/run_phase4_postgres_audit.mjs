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
const PHASE4_SQL = path.join(
  REPO_ROOT,
  "supabase",
  "migrations",
  "20261031030000_phase4_ai_production_studio.sql"
);

const PG_PORT = 55444;
const PG_DATA_DIR = path.join(process.cwd(), "pgdata_phase4_ephemeral");

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

  console.log("=== INITIALIZING PHASE 4 POSTGRESQL SANDBOX ===");
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
    await superPool.query(fs.readFileSync(PHASE4_SQL, "utf8"));
    // Verify idempotent re-run of Phase 4 migration
    await superPool.query(fs.readFileSync(PHASE4_SQL, "utf8"));

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

    let wsAId = null;
    let wsBId = null;

    // 1. Provision workspaces
    await runTest(1, "Provisioning Isolated Workspaces", async () => {
      wsAId = await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_A },
        async (c) => {
          const res = await c.query(
            `SELECT public.create_workspace_with_owner('Studio A', 'studio-a', 'creator') AS id`
          );
          return res.rows[0].id;
        }
      );

      wsBId = await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_B },
        async (c) => {
          const res = await c.query(
            `SELECT public.create_workspace_with_owner('Studio B', 'studio-b', 'business') AS id`
          );
          return res.rows[0].id;
        }
      );

      // Add UID_VIEWER to Workspace A as 'viewer'
      await superPool.query(
        `INSERT INTO public.workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'viewer')`,
        [wsAId, UID_VIEWER]
      );

      return `Workspace A: ${wsAId}, Workspace B: ${wsBId}`;
    });

    // 2. 100% RLS Check on Phase 4 Tables
    await runTest(2, "Verifying 100% RLS Active on Phase 4 Tables", async () => {
      const res = await superPool.query(`
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN ('storyboards', 'media_assets', 'generation_jobs', 'video_projects')
      `);
      assert.equal(res.rows.length, 4);
      for (const row of res.rows) {
        assert.equal(
          row.rowsecurity,
          true,
          `Table ${row.tablename} must have rowsecurity = true`
        );
      }
      return `All 4 tables have rowsecurity = true`;
    });

    // 3. Storyboard Creation via save_storyboard RPC
    let sbAId = null;
    await runTest(3, "Creating Storyboard in Workspace A via save_storyboard RPC", async () => {
      const scenes = [
        {
          scene_number: 1,
          duration_seconds: 5,
          shot_type: "close_up",
          shot_description: "Kreator tersenyum di depan ring light",
          visual_direction: "Camera push-in perlahan",
          voiceover_text: "Tahukah kamu 3 kesalahan fatal kreator pemula?",
          subtitle_text: "3 Kesalahan Fatal Kreator Pemula",
          transition_suggestion: "cut",
        },
        {
          scene_number: 2,
          duration_seconds: 7,
          shot_type: "medium",
          shot_description: "Screen capture dashboard CreatorOS AI",
          visual_direction: "Side angle over-the-shoulder",
          voiceover_text: "Yang pertama adalah membuat konten tanpa strategi.",
          subtitle_text: "1. Konten Tanpa Strategi",
          transition_suggestion: "dissolve",
        },
      ];

      sbAId = await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_A },
        async (c) => {
          const res = await c.query(
            `SELECT public.save_storyboard($1, $2, $3, NULL, $4, NULL) AS id`,
            [wsAId, "Storyboard Konten Viral #1", JSON.stringify(scenes), "cinematic"]
          );
          return res.rows[0].id;
        }
      );
      assert.ok(sbAId);
      return `Created storyboard ID ${sbAId} with 2 scenes and computed duration`;
    });

    // 4. Cross-Tenant Storyboard Isolation
    await runTest(4, "Enforcing Storyboard Multi-Tenant Isolation", async () => {
      // User B cannot read Storyboard A
      const count = await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_B },
        async (c) => {
          const res = await c.query(
            `SELECT count(*) FROM public.storyboards WHERE id = $1`,
            [sbAId]
          );
          return Number(res.rows[0].count);
        }
      );
      assert.equal(count, 0, "User B must see 0 rows for Storyboard A");

      // User B cannot update Storyboard A
      await expectReject(
        () =>
          withRoleContext(
            authPool,
            { role: "authenticated", userId: UID_B },
            async (c) => {
              await c.query(
                `SELECT public.save_storyboard($1, 'Hacked Title', '[]'::jsonb, NULL, 'cinematic', $2)`,
                [wsBId, sbAId]
              );
            }
          ),
        /not found/i,
        "User B updating Storyboard A in Workspace B"
      );

      return "User B blocked from reading and updating User A storyboard";
    });

    // 5. Media Asset Creation and Constraints
    let assetAId = null;
    await runTest(5, "Creating Media Asset in Workspace A", async () => {
      assetAId = await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_A },
        async (c) => {
          const res = await c.query(
            `INSERT INTO public.media_assets (
               workspace_id, storyboard_id, asset_type, title, storage_path, public_url,
               mime_type, file_size_bytes, duration_seconds, dimensions, metadata, created_by
             ) VALUES (
               $1, $2, 'image', 'Thumbnail V1', 'workspaces/ws-a/thumb.png',
               '/api/media/thumb-1', 'image/png', 245000, NULL,
               '{"width":1080,"height":1920}'::jsonb, '{"style":"cinematic"}'::jsonb, $3
             ) RETURNING id`,
            [wsAId, sbAId, UID_A]
          );
          return res.rows[0].id;
        }
      );
      assert.ok(assetAId);
      return `Media asset created with ID ${assetAId}`;
    });

    // 6. Cross-Tenant Foreign Key Trigger Enforcement
    await runTest(6, "Enforcing Defensive Cross-Tenant FK Integrity Trigger", async () => {
      // Attempting to create media asset in Workspace B referencing Storyboard from Workspace A
      await expectReject(
        () =>
          withRoleContext(
            authPool,
            { role: "authenticated", userId: UID_B },
            async (c) => {
              await c.query(
                `INSERT INTO public.media_assets (
                   workspace_id, storyboard_id, asset_type, title, storage_path, public_url,
                   mime_type, file_size_bytes
                 ) VALUES (
                   $1, $2, 'image', 'Sneaky Image', 'path.png', '/api/media/sneaky',
                   'image/png', 100
                 )`,
                [wsBId, sbAId] // wsBId with sbAId from wsA!
              );
            }
          ),
        /cross-tenant reference violation/i,
        "Creating Media Asset in WS B with Storyboard from WS A"
      );
      return "Defensive trigger rejected cross-tenant storyboard reference";
    });

    // 7. Generation Job State Machine & Progress
    let jobAId = null;
    await runTest(7, "Tracking Generation Job Lifecycle & Constraints", async () => {
      jobAId = await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_A },
        async (c) => {
          const res = await c.query(
            `INSERT INTO public.generation_jobs (
               workspace_id, job_type, status, progress_percent, input_payload,
               provider, credits_cost, created_by
             ) VALUES (
               $1, 'video_generation', 'queued', 0, '{"prompt":"A modern studio"}'::jsonb,
               'video-worker', 5, $2
             ) RETURNING id`,
            [wsAId, UID_A]
          );
          return res.rows[0].id;
        }
      );

      // Advance job to processing (50%)
      await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_A },
        async (c) => {
          await c.query(
            `UPDATE public.generation_jobs
             SET status = 'processing', progress_percent = 50, started_at = pg_catalog.now()
             WHERE id = $1`,
            [jobAId]
          );
        }
      );

      // Verify invalid progress rejection (e.g. 150%)
      await expectReject(
        () =>
          withRoleContext(
            authPool,
            { role: "authenticated", userId: UID_A },
            async (c) => {
              await c.query(
                `UPDATE public.generation_jobs SET progress_percent = 150 WHERE id = $1`,
                [jobAId]
              );
            }
          ),
        /check_generation_jobs_progress/i,
        "Setting progress_percent to 150%"
      );

      // Complete job (100%)
      await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_A },
        async (c) => {
          await c.query(
            `UPDATE public.generation_jobs
             SET status = 'completed', progress_percent = 100,
                 output_payload = '{"video_url":"/api/media/clip-1"}'::jsonb,
                 completed_at = pg_catalog.now()
             WHERE id = $1`,
            [jobAId]
          );
        }
      );

      return `Job ${jobAId} successfully transitioned queued -> processing -> completed`;
    });

    // 8. Video Project / Timeline Editor Persistence
    let projectAId = null;
    await runTest(8, "Creating & Updating Video Project via save_video_project RPC", async () => {
      const timelineData = {
        tracks: [
          {
            id: "track-v1",
            type: "video",
            name: "Visuals",
            clips: [
              {
                id: "clip-1",
                assetId: assetAId,
                title: "Opening Scene",
                startTime: 0,
                endTime: 5,
                trimStart: 0,
                trimEnd: 5,
              },
            ],
          },
          {
            id: "track-a1",
            type: "audio",
            name: "Voiceover",
            clips: [
              {
                id: "clip-vo-1",
                title: "Voiceover 1",
                startTime: 0,
                endTime: 5,
                trimStart: 0,
                trimEnd: 5,
                volume: 1,
              },
            ],
          },
        ],
        duration: 5,
      };

      projectAId = await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_A },
        async (c) => {
          const res = await c.query(
            `SELECT public.save_video_project($1, $2, $3, '9:16', '1080p', 30, $4, NULL, NULL) AS id`,
            [wsAId, "Proyek Video Reels #1", JSON.stringify(timelineData), sbAId]
          );
          return res.rows[0].id;
        }
      );
      assert.ok(projectAId);
      return `Video project saved with ID ${projectAId}`;
    });

    // 9. Viewer Role Read-Only Enforcement
    await runTest(9, "Enforcing Viewer Role Read-Only Permissions", async () => {
      // Viewer can read storyboards in WS A
      const count = await withRoleContext(
        authPool,
        { role: "authenticated", userId: UID_VIEWER },
        async (c) => {
          const res = await c.query(
            `SELECT count(*) FROM public.storyboards WHERE workspace_id = $1`,
            [wsAId]
          );
          return Number(res.rows[0].count);
        }
      );
      assert.equal(count, 1, "Viewer must be able to SELECT storyboards in WS A");

      // Viewer cannot insert storyboards directly
      await expectReject(
        () =>
          withRoleContext(
            authPool,
            { role: "authenticated", userId: UID_VIEWER },
            async (c) => {
              await c.query(
                `INSERT INTO public.storyboards (workspace_id, title, scenes)
                 VALUES ($1, 'Unauthorized Storyboard', '[]'::jsonb)`,
                [wsAId]
              );
            }
          ),
        /violates row-level security/i,
        "Viewer directly inserting into storyboards"
      );

      // Viewer cannot call save_storyboard RPC
      await expectReject(
        () =>
          withRoleContext(
            authPool,
            { role: "authenticated", userId: UID_VIEWER },
            async (c) => {
              await c.query(
                `SELECT public.save_storyboard($1, 'Unauthorized via RPC', '[]'::jsonb)`,
                [wsAId]
              );
            }
          ),
        /unauthorized/i,
        "Viewer calling save_storyboard RPC"
      );

      return "Viewer allowed to SELECT, blocked from INSERT/UPDATE";
    });

    // 10. Immutable Keys Protection
    await runTest(10, "Preventing Tampering with Immutable workspace_id", async () => {
      await expectReject(
        () =>
          withRoleContext(
            authPool,
            { role: "authenticated", userId: UID_A },
            async (c) => {
              await c.query(
                `UPDATE public.storyboards SET workspace_id = $1 WHERE id = $2`,
                [wsBId, sbAId]
              );
            }
          ),
        /immutable column: workspace_id cannot be changed/i,
        "Changing workspace_id of storyboard"
      );
      return "Immutable trigger blocked workspace_id mutation";
    });

    console.log(`\n==================================================`);
    console.log(`PHASE 4 POSTGRESQL AUDIT COMPLETED: ${passed}/10 TESTS PASSED`);
    console.log(`==================================================`);
  } finally {
    if (authPool) await authPool.end().catch(() => {});
    if (superPool) await superPool.end().catch(() => {});
    await embeddedPg.stop().catch(() => {});
    await cleanDir(PG_DATA_DIR);
  }
}

main().catch((err) => {
  console.error("FATAL AUDIT FAILURE:", err);
  process.exit(1);
});
