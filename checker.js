const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const { chromium } = require("playwright");

async function main() {
  console.log("Starting Affiliate Checker...");

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, auth);

  await doc.loadInfo();

  const sheet = doc.sheetsByTitle["Produk"];

  if (!sheet) {
    throw new Error('Sheet "Produk" tidak ditemukan');
  }

  const rows = await sheet.getRows();

  console.log(`Ditemukan ${rows.length} produk`);

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1280,
      height: 800,
    },
  });

  for (const row of rows) {
    const affiliateUrl = row.affiliate_url?.trim();

    if (!affiliateUrl) {
      continue;
    }

    console.log(`Checking: ${row.kode}`);

    try {
      await page.goto(affiliateUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page.waitForTimeout(5000);

      const finalUrl = page.url();

      const title = await page.title();

      let thumbnail = "";

      try {
        thumbnail = await page
          .locator('meta[property="og:image"]')
          .getAttribute("content");
      } catch (e) {}

      row.nama_produk = title || "";
      row.thumbnail = thumbnail || "";
      row.final_url = finalUrl;

      if (title && !title.toLowerCase().includes("error")) {
        row.status = "AKTIF";
      } else {
        row.status = "PERIKSA";
      }
    } catch (error) {
      row.status = "ERROR";

      console.log(error.message);
    }

    row.last_check = new Date().toISOString();

    await row.save();

    console.log(`${row.kode} updated`);
  }

  await browser.close();

  console.log("Affiliate Checker selesai");
}

main().catch(console.error);
