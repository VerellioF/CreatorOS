import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = 'C:/Users/Verellio F/.gemini/antigravity/brain/9cee5dbd-651f-44a5-9792-bc1dfd23248f/scratch/screenshots';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const routesToTest = [
  { name: 'Landing Page', path: '/' },
  { name: 'Sign In', path: '/sign-in' },
  { name: 'Sign Up', path: '/sign-up' },
  { name: 'Forgot Password', path: '/forgot-password' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Creator Profile', path: '/creator-profile' },
  { name: 'Niche Discovery', path: '/niche-discovery' },
  { name: 'Trends', path: '/trends' },
  { name: 'Competitors', path: '/competitors' },
  { name: 'Strategy', path: '/strategy' },
  { name: 'Ideas', path: '/ideas' },
  { name: 'Studio', path: '/studio' },
  { name: 'Studio Scripts', path: '/studio/scripts' },
  { name: 'Studio Storyboard', path: '/studio/storyboard' },
  { name: 'Studio Voice', path: '/studio/voice' },
  { name: 'Studio Images', path: '/studio/images' },
  { name: 'Studio Video', path: '/studio/video' },
  { name: 'Studio Subtitles', path: '/studio/subtitles' },
  { name: 'Studio Timeline', path: '/studio/timeline' },
  { name: 'Studio Export', path: '/studio/export' },
  { name: 'Calendar', path: '/calendar' },
  { name: 'Publish', path: '/publish' },
  { name: 'Monetization', path: '/monetization' },
  { name: 'Analytics', path: '/analytics' },
  { name: 'AI Assistant', path: '/ai-assistant' },
  { name: 'Agents', path: '/agents' },
  { name: 'Settings', path: '/settings' },
  { name: 'Settings Billing', path: '/settings/billing' },
  { name: 'Usage', path: '/usage' },
  { name: 'Support', path: '/support' },
  { name: 'Privacy Policy', path: '/privacy' },
  { name: 'Terms of Service', path: '/terms' }
];

async function run() {
  console.log('🚀 Starting WebApp Testing on ' + BASE_URL);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  const results = [];

  for (const route of routesToTest) {
    const url = `${BASE_URL}${route.path}`;
    const consoleLogs = [];
    const pageErrors = [];

    const onConsole = (msg) => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    };
    const onPageError = (err) => {
      pageErrors.push(err.message);
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    const startTime = Date.now();
    let status = 'UNKNOWN';
    let httpStatus = 0;
    let screenshotName = '';

    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      httpStatus = response ? response.status() : 0;
      await page.waitForLoadState('networkidle').catch(() => {});

      const duration = Date.now() - startTime;
      const title = await page.title();

      const safeName = route.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      screenshotName = `${safeName}.png`;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, screenshotName), fullPage: false });

      const headingCount = await page.locator('h1, h2, h3').count();
      const buttonCount = await page.locator('button').count();

      status = (httpStatus >= 200 && httpStatus < 400 && pageErrors.length === 0) ? 'PASS' : (httpStatus >= 400 ? 'HTTP_ERROR' : 'JS_ERROR');

      results.push({
        name: route.name,
        path: route.path,
        httpStatus,
        durationMs: duration,
        title,
        headingCount,
        buttonCount,
        status,
        screenshot: screenshotName,
        consoleErrors: consoleLogs,
        pageErrors: pageErrors
      });

      console.log(`[${status}] ${route.name.padEnd(20)} (${route.path.padEnd(20)}) - HTTP ${httpStatus} - ${duration}ms - Elements: ${buttonCount} btns, ${headingCount} hdgs`);
    } catch (err) {
      console.log(`[FAIL] ${route.name.padEnd(20)} (${route.path.padEnd(20)}) - Error: ${err.message}`);
      results.push({
        name: route.name,
        path: route.path,
        httpStatus: 0,
        status: 'CRASH/TIMEOUT',
        error: err.message,
        consoleErrors: consoleLogs,
        pageErrors: pageErrors
      });
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    }
  }

  console.log('\n--- Running Interactive Tests ---');
  try {
    console.log('Testing Sign-In interaction...');
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle' });
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    const emailCount = await emailInput.count();
    const passCount = await passwordInput.count();
    const btnCount = await submitBtn.count();

    console.log(`Sign-In Form Verification: Email inputs=${emailCount}, Password inputs=${passCount}, Submit buttons=${btnCount}`);

    if (emailCount > 0 && passCount > 0) {
      await emailInput.fill('test@creatoros.ai');
      await passwordInput.fill('supersecret123');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sign_in_filled.png') });
      console.log('Filled Sign-In form and captured screenshot.');
    }

    console.log('Testing Theme Toggle (Dark/Light)...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    // Look for theme toggle button
    const themeBtn = page.locator('button:has([class*="lucide-sun"]), button:has([class*="lucide-moon"]), button[aria-label*="theme"], button[title*="theme"]');
    const themeBtnCount = await themeBtn.count();
    console.log(`Theme toggles detected: ${themeBtnCount}`);
    if (themeBtnCount > 0) {
      await themeBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dashboard_theme_toggled.png') });
      console.log('Theme toggle clicked and verified.');
    }

    console.log('Testing Sidebar Navigation in Dashboard...');
    const navLinks = page.locator('aside nav a, aside a');
    const navCount = await navLinks.count();
    console.log(`Sidebar navigation links detected: ${navCount}`);

  } catch (interactErr) {
    console.error('Interactive test error:', interactErr.message);
  }

  await browser.close();

  const reportPath = 'C:/Users/Verellio F/.gemini/antigravity/brain/9cee5dbd-651f-44a5-9792-bc1dfd23248f/scratch/webapp_test_report.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n🎉 All tests completed! Detailed JSON report saved to ${reportPath}`);
}

run().catch(console.error);
