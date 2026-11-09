import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = 'C:/Users/Verellio F/.gemini/antigravity/brain/9cee5dbd-651f-44a5-9792-bc1dfd23248f/scratch/audit_screenshots';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runAudit() {
  console.log('='.repeat(60));
  console.log('🧪 CREATOROS AI — COMPREHENSIVE WEBAPP AUDIT & TESTING');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const auditReport = {
    summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
    sections: []
  };

  function recordResult(sectionName, testName, passed, details = {}, warning = false) {
    auditReport.summary.total++;
    if (passed) {
      auditReport.summary.passed++;
    } else if (warning) {
      auditReport.summary.warnings++;
    } else {
      auditReport.summary.failed++;
    }

    let section = auditReport.sections.find(s => s.name === sectionName);
    if (!section) {
      section = { name: sectionName, tests: [] };
      auditReport.sections.push(section);
    }
    section.tests.push({
      testName,
      status: passed ? 'PASS' : (warning ? 'WARN' : 'FAIL'),
      details
    });

    const mark = passed ? '✅ PASS' : (warning ? '⚠️ WARN' : '❌ FAIL');
    console.log(`[${mark}] ${sectionName} > ${testName}`);
  }

  // ==========================================
  // SECTION 1: Health Endpoints
  // ==========================================
  console.log('\n--- 1. Testing API Health Endpoints ---');
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const healthRes = await page.request.get(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json();
    recordResult('Health API', 'GET /api/health responds with valid payload', healthRes.status() === 200, {
      status: healthRes.status(),
      bodyStatus: healthJson.status,
      version: healthJson.version
    });

    const liveRes = await page.request.get(`${BASE_URL}/api/health/live`);
    recordResult('Health API', 'GET /api/health/live responds 200 OK', liveRes.status() === 200, {
      status: liveRes.status()
    });

    const readyRes = await page.request.get(`${BASE_URL}/api/health/ready`);
    recordResult('Health API', 'GET /api/health/ready status check', readyRes.status() === 200 || readyRes.status() === 503, {
      status: readyRes.status()
    }, readyRes.status() === 503);

    await context.close();
  } catch (err) {
    recordResult('Health API', 'Health Endpoints Accessible', false, { error: err.message });
  }

  // ==========================================
  // SECTION 2: Landing Page Deep Test
  // ==========================================
  console.log('\n--- 2. Testing Landing Page (Desktop & Mobile) ---');
  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktopPage = await desktopContext.newPage();

    const consoleErrors = [];
    desktopPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const res = await desktopPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    recordResult('Landing Page', 'Desktop HTTP 200 OK', res.status() === 200, { status: res.status() });

    const title = await desktopPage.title();
    recordResult('Landing Page', 'Title contains CreatorOS AI', title.includes('CreatorOS AI'), { title });

    // Check main elements
    const heading = await desktopPage.locator('h1').first().innerText().catch(() => '');
    recordResult('Landing Page', 'Hero H1 Headline is rendered', heading.length > 5, { heading });

    // Check CTA links
    const ctaLinks = await desktopPage.locator('a[href="/sign-up"], a[href="/sign-in"]').count();
    recordResult('Landing Page', 'Auth CTA buttons present', ctaLinks >= 2, { count: ctaLinks });

    // Check Pricing Section
    const pricingHeading = await desktopPage.locator('text=Paket Harga, text=Harga, text=Pricing').count();
    recordResult('Landing Page', 'Pricing section visible', pricingHeading > 0, { count: pricingHeading });

    // Check console clean
    recordResult('Landing Page', 'Zero JavaScript runtime errors on load', consoleErrors.length === 0, { errors: consoleErrors });

    await desktopPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_landing_desktop.png'), fullPage: false });

    // Mobile Viewport
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
    const mobileH1 = await mobilePage.locator('h1').first().isVisible();
    recordResult('Landing Page', 'Mobile Responsive Layout (375x812)', mobileH1, { h1Visible: mobileH1 });
    await mobilePage.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_landing_mobile.png'), fullPage: false });

    await desktopContext.close();
    await mobileContext.close();
  } catch (err) {
    recordResult('Landing Page', 'Landing page evaluation', false, { error: err.message });
  }

  // ==========================================
  // SECTION 3: Sign-In Flow & Form Validation
  // ==========================================
  console.log('\n--- 3. Testing Sign-In Form Interactivity & Validation ---');
  try {
    const authContext = await browser.newContext();
    const authPage = await authContext.newPage();

    await authPage.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle' });
    const emailInput = authPage.locator('input[type="email"]');
    const passwordInput = authPage.locator('input[type="password"]');
    const submitBtn = authPage.locator('button[type="submit"]');

    recordResult('Auth: Sign-In', 'Email & Password inputs rendered', (await emailInput.count() === 1) && (await passwordInput.count() === 1));
    recordResult('Auth: Sign-In', 'Submit button rendered', await submitBtn.count() === 1);

    // Empty form submission validation
    await submitBtn.click();
    await authPage.waitForTimeout(600);

    // Check for client-side HTML5 or React Hook Form validation
    const emailValid = await emailInput.evaluate(el => el.checkValidity());
    recordResult('Auth: Sign-In', 'Form catches empty submission validation', !emailValid);

    // Fill invalid email
    await emailInput.fill('invalid-email-format');
    await submitBtn.click();
    const emailFormatValid = await emailInput.evaluate(el => el.checkValidity());
    recordResult('Auth: Sign-In', 'Form catches invalid email format', !emailFormatValid);

    // Fill valid format
    await emailInput.fill('kreator@creatoros.ai');
    await passwordInput.fill('Password123!');
    const formValid = await emailInput.evaluate(el => el.checkValidity());
    recordResult('Auth: Sign-In', 'Valid input format accepted', formValid);

    await authPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_signin_form_validation.png') });

    // Link navigation to Sign-Up
    const signUpLink = authPage.locator('a[href="/sign-up"]');
    recordResult('Auth: Sign-In', 'Link to Sign-Up page is present', (await signUpLink.count()) > 0);

    // Link navigation to Forgot Password
    const forgotLink = authPage.locator('a[href="/forgot-password"]');
    recordResult('Auth: Sign-In', 'Link to Forgot Password is present', (await forgotLink.count()) > 0);

    await authContext.close();
  } catch (err) {
    recordResult('Auth: Sign-In', 'Sign-In flow evaluation', false, { error: err.message });
  }

  // ==========================================
  // SECTION 4: Sign-Up Form & Validation
  // ==========================================
  console.log('\n--- 4. Testing Sign-Up Form Interactivity & Validation ---');
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/sign-up`, { waitUntil: 'networkidle' });

    const emailInput = page.locator('input[type="email"]');
    const passwordInputs = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    recordResult('Auth: Sign-Up', 'Email input rendered', await emailInput.count() === 1);
    recordResult('Auth: Sign-Up', 'Password input(s) rendered', (await passwordInputs.count()) >= 1);
    recordResult('Auth: Sign-Up', 'Submit button rendered', await submitBtn.count() === 1);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_signup_page.png') });
    await context.close();
  } catch (err) {
    recordResult('Auth: Sign-Up', 'Sign-Up flow evaluation', false, { error: err.message });
  }

  // ==========================================
  // SECTION 5: Security Boundary & Route Guards
  // ==========================================
  console.log('\n--- 5. Testing Security Boundary & RLS Route Protection ---');
  const protectedRoutes = [
    '/dashboard',
    '/creator-profile',
    '/niche-discovery',
    '/trends',
    '/competitors',
    '/strategy',
    '/ideas',
    '/studio',
    '/studio/scripts',
    '/studio/storyboard',
    '/studio/voice',
    '/studio/images',
    '/studio/video',
    '/calendar',
    '/publish',
    '/monetization',
    '/analytics',
    '/ai-assistant',
    '/agents',
    '/settings',
    '/usage',
    '/admin'
  ];

  try {
    const secContext = await browser.newContext();
    const secPage = await secContext.newPage();

    let allProtectedRedirected = true;
    const redirectDetails = [];

    for (const route of protectedRoutes) {
      await secPage.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      const currentUrl = secPage.url();
      const isRedirectedToSignIn = currentUrl.includes('/sign-in');
      const hasRedirectParam = currentUrl.includes('redirectTo=');

      if (!isRedirectedToSignIn || !hasRedirectParam) {
        allProtectedRedirected = false;
      }
      redirectDetails.push({ route, target: currentUrl, protected: isRedirectedToSignIn && hasRedirectParam });
    }

    recordResult(
      'Security Boundary',
      `All ${protectedRoutes.length} protected routes enforce middleware redirect to /sign-in?redirectTo=...`,
      allProtectedRedirected,
      { checkedRoutes: protectedRoutes.length, sample: redirectDetails.slice(0, 3) }
    );

    await secContext.close();
  } catch (err) {
    recordResult('Security Boundary', 'Middleware redirect verification', false, { error: err.message });
  }

  // ==========================================
  // SECTION 6: Public Legal Pages
  // ==========================================
  console.log('\n--- 6. Testing Public Legal & Info Pages ---');
  try {
    const legalContext = await browser.newContext();
    const legalPage = await legalContext.newPage();

    const privacyRes = await legalPage.goto(`${BASE_URL}/privacy`, { waitUntil: 'networkidle' });
    const privacyTitle = await legalPage.title();
    recordResult('Legal Pages', 'Privacy Policy loads with HTTP 200', privacyRes.status() === 200, { title: privacyTitle });
    await legalPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_privacy_policy.png') });

    const termsRes = await legalPage.goto(`${BASE_URL}/terms`, { waitUntil: 'networkidle' });
    const termsTitle = await legalPage.title();
    recordResult('Legal Pages', 'Terms of Service loads with HTTP 200', termsRes.status() === 200, { title: termsTitle });
    await legalPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_terms_of_service.png') });

    await legalContext.close();
  } catch (err) {
    recordResult('Legal Pages', 'Legal pages evaluation', false, { error: err.message });
  }

  await browser.close();

  // Save audit results
  const finalReportPath = 'C:/Users/Verellio F/.gemini/antigravity/brain/9cee5dbd-651f-44a5-9792-bc1dfd23248f/scratch/audit_report.json';
  fs.writeFileSync(finalReportPath, JSON.stringify(auditReport, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`📊 AUDIT SUMMARY: Total: ${auditReport.summary.total} | Passed: ${auditReport.summary.passed} | Warnings: ${auditReport.summary.warnings} | Failed: ${auditReport.summary.failed}`);
  console.log('='.repeat(60));
}

runAudit().catch(console.error);
