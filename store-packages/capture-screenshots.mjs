import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';
const OUT = '/home/runner/workspace/store-packages/screenshots';

const PHONE = { width: 430, height: 932, deviceScaleFactor: 3 };
const TABLET = { width: 1024, height: 1366, deviceScaleFactor: 2 };
const DESKTOP = { width: 1920, height: 1080, deviceScaleFactor: 1 };

async function run() {
  const browser = await chromium.launch({ headless: true });

  const phoneCtx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: PHONE.deviceScaleFactor });
  const tabletCtx = await browser.newContext({ viewport: TABLET, deviceScaleFactor: TABLET.deviceScaleFactor });
  const desktopCtx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: DESKTOP.deviceScaleFactor });

  const phonePage = await phoneCtx.newPage();
  const tabletPage = await tabletCtx.newPage();
  const desktopPage = await desktopCtx.newPage();

  console.log('1. Capturing landing page...');
  await phonePage.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await phonePage.waitForTimeout(2000);
  await phonePage.screenshot({ path: `${OUT}/01-landing-phone.png`, fullPage: false });

  await desktopPage.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: `${OUT}/01-landing-desktop.png`, fullPage: false });

  await tabletPage.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await tabletPage.waitForTimeout(2000);
  await tabletPage.screenshot({ path: `${OUT}/01-landing-tablet.png`, fullPage: false });

  console.log('2. Logging in...');
  for (const page of [phonePage, tabletPage, desktopPage]) {
    const resp = await page.request.post(BASE + '/api/auth/test-login', {
      data: { username: 'test', password: 'password123' },
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`   Login: ${resp.status()}`);
  }

  console.log('3. Capturing dashboard...');
  await phonePage.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await phonePage.waitForTimeout(3000);
  await phonePage.screenshot({ path: `${OUT}/02-dashboard-phone.png`, fullPage: false });

  await desktopPage.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(3000);
  await desktopPage.screenshot({ path: `${OUT}/02-dashboard-desktop.png`, fullPage: false });

  await tabletPage.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await tabletPage.waitForTimeout(3000);
  await tabletPage.screenshot({ path: `${OUT}/02-dashboard-tablet.png`, fullPage: false });

  console.log('4. Capturing systems directory...');
  await phonePage.goto(BASE + '/systems', { waitUntil: 'networkidle', timeout: 30000 });
  await phonePage.waitForTimeout(2000);
  await phonePage.screenshot({ path: `${OUT}/03-systems-phone.png`, fullPage: false });

  await desktopPage.goto(BASE + '/systems', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: `${OUT}/03-systems-desktop.png`, fullPage: false });

  console.log('5. Capturing maintenance log...');
  await phonePage.goto(BASE + '/maintenance-log', { waitUntil: 'networkidle', timeout: 30000 });
  await phonePage.waitForTimeout(2000);
  await phonePage.screenshot({ path: `${OUT}/04-maintenance-phone.png`, fullPage: false });

  await desktopPage.goto(BASE + '/maintenance-log', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: `${OUT}/04-maintenance-desktop.png`, fullPage: false });

  console.log('6. Capturing documents...');
  await phonePage.goto(BASE + '/documents', { waitUntil: 'networkidle', timeout: 30000 });
  await phonePage.waitForTimeout(2000);
  await phonePage.screenshot({ path: `${OUT}/05-documents-phone.png`, fullPage: false });

  await desktopPage.goto(BASE + '/documents', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: `${OUT}/05-documents-desktop.png`, fullPage: false });

  console.log('7. Capturing document analysis...');
  await phonePage.goto(BASE + '/document-analysis', { waitUntil: 'networkidle', timeout: 30000 });
  await phonePage.waitForTimeout(2000);
  await phonePage.screenshot({ path: `${OUT}/06-analysis-phone.png`, fullPage: false });

  await desktopPage.goto(BASE + '/document-analysis', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: `${OUT}/06-analysis-desktop.png`, fullPage: false });

  console.log('8. Capturing chat assistant...');
  await phonePage.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 30000 });
  await phonePage.waitForTimeout(2000);
  await phonePage.screenshot({ path: `${OUT}/07-chat-phone.png`, fullPage: false });

  await desktopPage.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: `${OUT}/07-chat-desktop.png`, fullPage: false });

  console.log('9. Capturing profile...');
  await phonePage.goto(BASE + '/profile', { waitUntil: 'networkidle', timeout: 30000 });
  await phonePage.waitForTimeout(2000);
  await phonePage.screenshot({ path: `${OUT}/08-profile-phone.png`, fullPage: false });

  await desktopPage.goto(BASE + '/profile', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: `${OUT}/08-profile-desktop.png`, fullPage: false });

  await browser.close();
  console.log('\nAll screenshots saved to store-packages/screenshots/');
}

run().catch(e => { console.error(e); process.exit(1); });
