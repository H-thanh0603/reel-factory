const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.log('ERR:', e.message));
  await page.goto('file:///home/nht/.zcode/workspace/60458c32-f992-4286-8363-1442bd7fb84d/reel-factory/output/029/page.html');
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    window.__render(24);
    const host = document.getElementById('beats');
    return [...host.children].map(el => ({
      op: el.style.opacity, disp: getComputedStyle(el).display,
      big: (el.querySelector('.big')||{}).textContent || null, html: el.innerHTML.slice(0,80)
    }));
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
