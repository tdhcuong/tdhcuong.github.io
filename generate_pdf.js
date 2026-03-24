const puppeteer = require('puppeteer');
const httpServer = require('http-server');

(async () => {
  // Start local HTTP server so all CDN assets load
  const server = httpServer.createServer({ root: __dirname });
  await new Promise(r => server.listen(8765, r));

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Match the desktop breakpoint that shows sidebar + main side by side
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  await page.goto('http://localhost:8765/index.html', {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });

  // Wait for fonts, animations, AOS to settle
  await new Promise(r => setTimeout(r, 3000));

  const SCALE = 0.552;
  // A4 height in px at 96dpi = 297mm * (96/25.4) ≈ 1122.5px
  // Subtract a small safety margin so we never overshoot into an extra page
  const PAGE_HEIGHT_PX = (297 * 96 / 25.4) / SCALE; // ≈ 2033.5px exact

  // Force skill bars to final state and reveal all AOS elements
  await page.evaluate((pageHeightPx) => {
    // Freeze the spinning profile ring at 0° so the inner photo isn't rotated
    const ringOuter = document.querySelector('.profile-ring-outer');
    if (ringOuter) {
      ringOuter.style.animation = 'none';
      ringOuter.style.transform = 'rotate(0deg)';
    }

    document.querySelectorAll('.skill-fill').forEach(el => {
      el.style.width = el.dataset.w + '%';
      el.style.transition = 'none';
    });
    document.querySelectorAll('[data-aos]').forEach(el => {
      el.classList.add('aos-animate');
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    // Hide the Download CV button from the PDF
    document.querySelectorAll('a[download]').forEach(el => {
      el.style.display = 'none';
    });

    // Stretch the flex wrapper to fill the last page completely.
    // Use min-height so content never shrinks, only grows.
    const docHeight = document.documentElement.scrollHeight;
    const pages = Math.ceil(docHeight / pageHeightPx);
    const targetHeight = pages * pageHeightPx;

    const wrapper = document.querySelector('div.flex.min-h-screen');
    if (wrapper) {
      wrapper.style.minHeight = targetHeight + 'px';
    }

    // Fix sidebar: absolute so content only shows on page 1,
    // but background stripe stretches the full document height.
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.style.position = 'absolute';
      sidebar.style.top = '0';
      sidebar.style.left = '0';
      sidebar.style.height = targetHeight + 'px';
      sidebar.style.maxHeight = 'none';
      sidebar.style.overflowY = 'visible';
    }
  }, PAGE_HEIGHT_PX);

  // A4 is 794px wide at 96dpi. Scale 1440px layout down to fit.
  // 794 / 1440 ≈ 0.552
  await page.pdf({
    path: 'tdhcuong_cv.pdf',
    format: 'A4',
    landscape: false,
    printBackground: true,
    preferCSSPageSize: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    scale: SCALE,
  });

  await browser.close();
  server.close();
  console.log('PDF generated: tdhcuong_cv.pdf');
})();
