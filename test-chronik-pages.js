const { ChronikClient } = require('chronik-client');

const FIRMA_TOKEN_ID = '0387947fd575db4fb19a3e322f635dec37fd192b5941625b66bc4b2c3008cbf0';
const TRIDENT_TOKEN_ID = '8814140e9d5dc359fe437d881c2c324b4e37c71bfd23226309940d742651e14b';

async function testTokenHistory(tokenId, tokenName) {
  console.log(`\n========== Testing ${tokenName} (${tokenId.substring(0, 8)}) ==========`);

  const chronik = new ChronikClient('https://chronik-native1.fabien.cash');
  const pageSize = 200;

  let totalPages = 0;
  let totalTxs = 0;

  for (let page = 0; page < 10; page++) {
    try {
      const history = await chronik.tokenId(tokenId).history(page, pageSize);
      const txs = history?.txs || [];

      totalPages++;
      totalTxs += txs.length;

      console.log(`Page ${page}: fetched ${txs.length} txs, total so far: ${totalTxs}`);

      if (txs.length > 0) {
        const firstTx = txs[0];
        const lastTx = txs[txs.length - 1];
        const firstTime = firstTx.block?.timestamp || firstTx.timeFirstSeen || 0;
        const lastTime = lastTx.block?.timestamp || lastTx.timeFirstSeen || 0;
        const firstHeight = firstTx.block?.height || 'unconfirmed';
        const lastHeight = lastTx.block?.height || 'unconfirmed';

        console.log(`  First tx: time=${new Date(firstTime * 1000).toISOString()}, height=${firstHeight}`);
        console.log(`  Last tx: time=${new Date(lastTime * 1000).toISOString()}, height=${lastHeight}`);
      }

      // Stop if we got less than pageSize (no more data)
      if (txs.length < pageSize) {
        console.log(`\nStopped at page ${page} (no more data)`);
        break;
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error.message);
      break;
    }
  }

  console.log(`\nTotal: ${totalPages} pages, ${totalTxs} transactions`);
}

async function main() {
  await testTokenHistory(FIRMA_TOKEN_ID, 'Firma');
  await testTokenHistory(TRIDENT_TOKEN_ID, 'TridentbyHodlWars');
}

main().catch(console.error);
