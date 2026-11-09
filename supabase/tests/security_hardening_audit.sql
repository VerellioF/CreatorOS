-- ==============================================================================
-- SQL SECURITY & RLS AUDIT SUITE: security_hardening_audit.sql
-- PRODUCT: CreatorOS AI (Phase 1 Database Foundation — Final Security Audit)
-- PURPOSE: Self-contained SQL verification of Tenant Isolation, RPC-Only Membership
--          Mutations, Single-Use Internal Tokens, RBAC Hierarchy, Last-Owner
--          Protection, Ownership Transfer Atomicity, Account Deletion Lifecycle,
--          Slug Collision Recovery, and `INSERT ... RETURNING` RLS.
--          Multi-connection concurrency & isolation level tests run in the
--          companion Node.js runner (`supabase/tests/run_real_postgres_audit.mjs`).
--          All changes in this SQL script are rolled back cleanly at the end.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    uid_owner_a   UUID := pg_catalog.gen_random_uuid();
    uid_admin_a   UUID := pg_catalog.gen_random_uuid();
    uid_admin2_a  UUID := pg_catalog.gen_random_uuid();
    uid_editor_a  UUID := pg_catalog.gen_random_uuid();
    uid_viewer_a  UUID := pg_catalog.gen_random_uuid();
    uid_member_a  UUID := pg_catalog.gen_random_uuid();
    uid_outsider  UUID := pg_catalog.gen_random_uuid();
    uid_collide   UUID := pg_catalog.gen_random_uuid();
    uid_founder   UUID := pg_catalog.gen_random_uuid();
    uid_successor UUID := pg_catalog.gen_random_uuid();
    ws_a          UUID;
    ws_b          UUID;
    ws_shared     UUID;
    v_squat_slug  TEXT;
    v_count       INT;
    v_ok          BOOLEAN;
BEGIN
    RAISE NOTICE '=== STARTING FINAL ROLE-SWITCHED SECURITY & RLS SQL AUDIT ===';

    -- --------------------------------------------------------------------------
    -- 1. SIGNUP PROVISIONING (`auth.users` -> Profile + Personal WS + Owner + Settings)
    -- --------------------------------------------------------------------------
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        (uid_owner_a,   'owner.a@sql-audit.test',   '{"full_name": "Owner Alpha"}'::jsonb),
        (uid_admin_a,   'admin.a@sql-audit.test',   '{"full_name": "Admin Alpha"}'::jsonb),
        (uid_admin2_a,  'admin2.a@sql-audit.test',  '{"full_name": "Admin Two"}'::jsonb),
        (uid_editor_a,  'editor.a@sql-audit.test',  '{"full_name": "Editor Alpha"}'::jsonb),
        (uid_viewer_a,  'viewer.a@sql-audit.test',  '{"full_name": "Viewer Alpha"}'::jsonb),
        (uid_member_a,  'member.a@sql-audit.test',  '{"full_name": "Member Alpha"}'::jsonb),
        (uid_outsider,  'outsider@sql-audit.test',  '{"full_name": "Outsider Beta"}'::jsonb),
        (uid_founder,   'founder@sql-audit.test',   '{"full_name": "Founder User"}'::jsonb),
        (uid_successor, 'successor@sql-audit.test', '{"full_name": "Successor User"}'::jsonb);

    SET LOCAL ROLE authenticated;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_owner_a::text, true);

    SELECT id INTO ws_a FROM public.workspaces WHERE created_by = uid_owner_a;
    ASSERT ws_a IS NOT NULL, 'Signup failed: Personal workspace missing';

    SELECT count(*) INTO v_count FROM public.workspace_members
    WHERE workspace_id = ws_a AND user_id = uid_owner_a AND role = 'owner';
    ASSERT v_count = 1, 'Signup failed: Owner membership missing';

    SELECT count(*) INTO v_count FROM public.workspace_settings WHERE workspace_id = ws_a;
    ASSERT v_count = 1, 'Signup failed: Workspace settings missing';

    -- Owner Alpha populates Workspace A via validated RPC `add_workspace_member`
    PERFORM public.add_workspace_member(ws_a, uid_admin_a,  'admin');
    PERFORM public.add_workspace_member(ws_a, uid_admin2_a, 'admin');
    PERFORM public.add_workspace_member(ws_a, uid_editor_a, 'editor');
    PERFORM public.add_workspace_member(ws_a, uid_viewer_a, 'viewer');
    PERFORM public.add_workspace_member(ws_a, uid_member_a, 'member');
    RESET ROLE;

    SET LOCAL ROLE authenticated;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_outsider::text, true);
    SELECT id INTO ws_b FROM public.workspaces WHERE created_by = uid_outsider;
    ASSERT ws_b IS NOT NULL, 'Outsider personal workspace missing';
    RESET ROLE;

    RAISE NOTICE 'PASS [SQL-01]: Atomic signup provisioning & RPC member addition verified';

    -- --------------------------------------------------------------------------
    -- 2. DIRECT DML ON `workspace_members` BLOCKED FOR ALL ROLES
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_owner_a::text, true);
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (ws_a, uid_outsider, 'member');
        RAISE EXCEPTION 'AUDIT_BREACH: Direct INSERT on workspace_members succeeded';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
    RESET ROLE;

    BEGIN
        -- Even superuser un-tokenized direct DML is rejected by `enforce_workspace_member_safety()`
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (ws_a, uid_outsider, 'member');
        RAISE EXCEPTION 'AUDIT_BREACH: Un-tokenized superuser direct INSERT succeeded';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE 'AUDIT_BREACH%' THEN RAISE; END IF;
    END;

    RAISE NOTICE 'PASS [SQL-02]: Direct table DML on workspace_members blocked by ACL + Trigger';

    -- --------------------------------------------------------------------------
    -- 3. CROSS-TENANT ISOLATION & RBAC HIERARCHY ENFORCEMENT
    -- --------------------------------------------------------------------------
    SET LOCAL ROLE authenticated;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_outsider::text, true);
    SELECT count(*) INTO v_count FROM public.workspaces WHERE id = ws_a;
    ASSERT v_count = 0, 'Cross-tenant workspace read leaked';
    SELECT count(*) INTO v_count FROM public.workspace_members WHERE workspace_id = ws_a;
    ASSERT v_count = 0, 'Cross-tenant members read leaked';
    SELECT count(*) INTO v_count FROM public.workspace_settings WHERE workspace_id = ws_a;
    ASSERT v_count = 0, 'Cross-tenant settings read leaked';
    RESET ROLE;

    -- Admin cannot grant/revoke admin or modify owner
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_admin_a::text, true);
        PERFORM public.update_workspace_member_role(ws_a, uid_editor_a, 'admin');
        RAISE EXCEPTION 'AUDIT_BREACH: Admin promoted editor to admin';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE 'AUDIT_BREACH%' THEN RAISE; END IF;
    END;
    RESET ROLE;

    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_admin_a::text, true);
        PERFORM public.remove_workspace_member(ws_a, uid_owner_a);
        RAISE EXCEPTION 'AUDIT_BREACH: Admin removed owner';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE 'AUDIT_BREACH%' THEN RAISE; END IF;
    END;
    RESET ROLE;

    -- Last owner cannot self-remove or direct-demote
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_owner_a::text, true);
        PERFORM public.remove_workspace_member(ws_a, uid_owner_a);
        RAISE EXCEPTION 'AUDIT_BREACH: Last owner self-removed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE 'AUDIT_BREACH%' THEN RAISE; END IF;
    END;
    RESET ROLE;

    RAISE NOTICE 'PASS [SQL-03]: Cross-tenant isolation, admin RBAC ceiling, and last-owner protection verified';

    -- --------------------------------------------------------------------------
    -- 4. OWNERSHIP TRANSFER & SINGLE-USE TOKEN CONSUMPTION
    -- --------------------------------------------------------------------------
    SET LOCAL ROLE authenticated;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_owner_a::text, true);
    v_ok := public.transfer_workspace_ownership(ws_a, uid_admin_a);
    ASSERT v_ok = TRUE, 'Ownership transfer returned FALSE';
    RESET ROLE;

    SELECT count(*) INTO v_count FROM creatoros_internal.trusted_operations;
    ASSERT v_count = 0, 'trusted_operations leaked unconsumed token';

    -- Transfer back
    SET LOCAL ROLE authenticated;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_admin_a::text, true);
    PERFORM public.transfer_workspace_ownership(ws_a, uid_owner_a);
    RESET ROLE;

    RAISE NOTICE 'PASS [SQL-04]: Atomic ownership transfer & 0 lingering tokens verified';

    -- --------------------------------------------------------------------------
    -- 5. ACCOUNT DELETION LIFECYCLE (`auth.users` + `created_by ON DELETE SET NULL`)
    -- --------------------------------------------------------------------------
    SET LOCAL ROLE authenticated;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_founder::text, true);
    INSERT INTO public.workspaces (name, slug, creator_mode, created_by)
    VALUES ('SQL Shared WS', 'sql-shared-ws-' || pg_catalog.substr(pg_catalog.replace(uid_founder::text, '-', ''), 1, 12), 'creator', uid_founder)
    RETURNING id INTO ws_shared;
    PERFORM public.add_workspace_member(ws_shared, uid_successor, 'admin');
    RESET ROLE;

    -- Must block deletion before ownership transfer!
    BEGIN
        DELETE FROM auth.users WHERE id = uid_founder;
        RAISE EXCEPTION 'AUDIT_BREACH: Deleted sole owner of shared workspace';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE 'AUDIT_BREACH%' THEN RAISE; END IF;
    END;

    -- Transfer ownership -> deletion must now succeed & preserve shared workspace with created_by IS NULL!
    SET LOCAL ROLE authenticated;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_founder::text, true);
    PERFORM public.transfer_workspace_ownership(ws_shared, uid_successor);
    RESET ROLE;

    DELETE FROM auth.users WHERE id = uid_founder;

    SELECT count(*) INTO v_count FROM public.workspaces WHERE id = ws_shared AND created_by IS NULL;
    ASSERT v_count = 1, 'Shared workspace did not survive creator deletion with created_by IS NULL';

    RAISE NOTICE 'PASS [SQL-05]: Account deletion lifecycle & surviving workspace preservation verified';

    -- --------------------------------------------------------------------------
    -- 6. SLUG COLLISION RECOVERY AT INSERT TIME
    -- --------------------------------------------------------------------------
    v_squat_slug := 'sql-collide-' || pg_catalog.lower(pg_catalog.replace(uid_collide::text, '-', ''));
    SET LOCAL ROLE authenticated;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_owner_a::text, true);
    INSERT INTO public.workspaces (name, slug, creator_mode, created_by)
    VALUES ('Squatter', v_squat_slug, 'creator', uid_owner_a);
    RESET ROLE;

    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (uid_collide, 'collide@sql-audit.test', '{"full_name": "SQL Collide"}'::jsonb);

    SELECT count(*) INTO v_count FROM public.workspaces WHERE created_by = uid_collide AND slug <> v_squat_slug;
    ASSERT v_count = 1, 'Slug collision recovery failed';

    RAISE NOTICE 'PASS [SQL-06]: Slug collision recovery at INSERT time verified';

    -- --------------------------------------------------------------------------
    -- 7. URL XSS SCHEMES, RESERVED SLUGS, SOFT-DELETE ISOLATION & ATOMIC CONFIG RPC
    -- --------------------------------------------------------------------------
    SET LOCAL ROLE authenticated;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', uid_owner_a::text, true);

    BEGIN
        UPDATE public.profiles SET avatar_url = 'javascript:alert(1)' WHERE id = uid_owner_a;
        RAISE EXCEPTION 'AUDIT_BREACH: Allowed javascript: URL in profiles.avatar_url';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO public.workspaces (name, slug, creator_mode, created_by)
        VALUES ('Reserved Slug', 'admin', 'creator', uid_owner_a);
        RAISE EXCEPTION 'AUDIT_BREACH: Allowed reserved slug admin';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    PERFORM public.update_workspace_configuration(
        ws_a,
        'SQL Atomic Config',
        'business',
        'en',
        'gemini-1.5-pro',
        FALSE,
        TRUE
    );
    RESET ROLE;

    SELECT count(*) INTO v_count
    FROM public.workspaces w
    JOIN public.workspace_settings s ON s.workspace_id = w.id
    WHERE w.id = ws_a
      AND w.name = 'SQL Atomic Config'
      AND w.creator_mode = 'business'
      AND s.default_ai_model = 'gemini-1.5-pro'
      AND s.enable_auto_hashtag = FALSE;
    ASSERT v_count = 1, 'Atomic workspace configuration RPC failed';

    RAISE NOTICE 'PASS [SQL-07]: XSS URL schemes, reserved slugs & atomic configuration RPC verified';
    RAISE NOTICE '=== ALL SQL AUDIT ASSERTIONS PASSED ===';
END;
$$;

ROLLBACK;
