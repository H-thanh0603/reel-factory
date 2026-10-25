const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => console.log('PAGE:', m.text()));
  page.on('pageerror', e => console.log('ERR:', e.message));
  await page.goto('file:///home/nht/.zcode/workspace/60458c32-f992-4286-8363-1442bd7fb84d/reel-factory/output/011/page.html');
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const g = document.getElementById('d-grid');
    const b = document.getElementById('d-blobs');
    const blob = b ? b.children[0] : null;
    return {
      gridDisplay: g && getComputedStyle(g).display,
      gridBg: g && getComputedStyle(g).backgroundImage.slice(0, 80),
      blobsCount: b ? b.children.length : 0,
      blob0: blob && { display: getComputedStyle(blob).display, w: blob.style.width, bg: blob.style.background, op: blob.style.opacity, transform: blob.style.transform, filter: getComputedStyle(blob).filter, zIndex: getComputedStyle(blob).zIndex, pos: getComputedStyle(blob).position },
      stageZ: getComputedStyle(document.getElementById('beats')).zIndex,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
