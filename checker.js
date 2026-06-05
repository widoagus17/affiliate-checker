const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { chromium } = require('playwright');

async function main() {

    console.log('Starting Affiliate Checker...');

    const credentials = JSON.parse(
        process.env.GOOGLE_CREDENTIALS
    );

    console.log(
        'Service Account:',
        credentials.client_email
    );

    const auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets'
        ]
    });

    const doc = new GoogleSpreadsheet(
        process.env.SHEET_ID,
        auth
    );

    await doc.loadInfo();

    console.log(
        'Spreadsheet:',
        doc.title
    );

    console.log('Daftar Sheet:');

    doc.sheetsByIndex.forEach(sheet => {
        console.log('- ' + sheet.title);
    });

    const sheet = doc.sheetsByIndex[0];

    const rows = await sheet.getRows();

    console.log(
        `Ditemukan ${rows.length} produk`
    );

    if (rows.length === 0) {
        console.log('Tidak ada data');
        return;
    }

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage({
        viewport: {
            width: 1366,
            height: 768
        },
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
    });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {

        const row = rows[i];

        console.log('\n================================');
        console.log(`BARIS ${i + 1}`);

        const rowData = row.toObject();

        console.log(rowData);

        const affiliateUrl =
            rowData.affiliate_url ||
            rowData.link ||
            rowData.url ||
            rowData.affiliate ||
            rowData.affiliateLink ||
            '';

        if (!affiliateUrl) {

            console.log(
                'Link affiliate kosong'
            );

            row.set(
                'status',
                'LINK KOSONG'
            );

            row.set(
                'last_check',
                new Date().toISOString()
            );

            await row.save();

            continue;
        }

        console.log(
            'URL:',
            affiliateUrl
        );

        try {

            await page.goto(
                affiliateUrl,
                {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                }
            );

            await page.waitForTimeout(5000);

            const finalUrl = page.url();

            const title =
                await page.title();

            let thumbnail = '';

            try {

                const metaImage =
                    page.locator(
                        'meta[property="og:image"]'
                    );

                const count =
                    await metaImage.count();

                if (count > 0) {

                    thumbnail =
                        await metaImage
                        .first()
                        .getAttribute(
                            'content'
                        );
                }

            } catch (e) {

                console.log(
                    'Thumbnail tidak ditemukan'
                );
            }

            console.log(
                'TITLE:',
                title
            );

            console.log(
                'FINAL URL:',
                finalUrl
            );

            console.log(
                'THUMBNAIL:',
                thumbnail
            );

            row.set(
                'nama_produk',
                title || ''
            );

            row.set(
                'thumbnail',
                thumbnail || ''
            );

            row.set(
                'final_url',
                finalUrl || ''
            );

            row.set(
                'status',
                'AKTIF'
            );

            row.set(
                'last_check',
                new Date().toISOString()
            );

            await row.save();

            successCount++;

            console.log(
                'Data berhasil disimpan'
            );

        } catch (error) {

            console.log(
                'ERROR:',
                error.message
            );

            try {

                row.set(
                    'status',
                    'ERROR'
                );

                row.set(
                    'last_check',
                    new Date().toISOString()
                );

                await row.save();

            } catch (saveError) {

                console.log(
                    'Gagal menyimpan status error'
                );
            }

            errorCount++;
        }
    }

    await browser.close();

    console.log('\n================================');
    console.log('SELESAI');
    console.log(
        `Berhasil : ${successCount}`
    );
    console.log(
        `Gagal    : ${errorCount}`
    );
    console.log('================================');
}

main().catch(error => {

    console.error(
        'FATAL ERROR:'
    );

    console.error(error);
});
