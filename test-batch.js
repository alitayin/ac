// Test if onBatch is called for every page
const testData = {
  page0: { txs: Array(200).fill({}).map((_, i) => ({ id: i, isAgora: i % 2 === 0 })) },
  page1: { txs: Array(200).fill({}).map((_, i) => ({ id: i + 200, isAgora: i % 2 === 0 })) },
  page2: { txs: Array(200).fill({}).map((_, i) => ({ id: i + 400, isAgora: i % 2 === 0 })) },
  page3: { txs: Array(200).fill({}).map((_, i) => ({ id: i + 600, isAgora: i % 3 === 0 })) },
};

let pagesRead = 0;
let batchCalls = 0;

// Simulate the callback
function onBatch(batch, meta) {
  batchCalls++;
  pagesRead = meta.page + 1;
  console.log(`Page ${meta.page}: batch.length = ${batch.length}, pagesRead = ${pagesRead}`);
}

// Simulate processing
for (let page = 0; page < 4; page++) {
  const txs = testData[`page${page}`].txs;
  const batch = txs.filter(tx => tx.isAgora); // Simulate filtering
  
  if (batch.length > 0) {
    onBatch(batch, { page });
  }
}

console.log(`\nTotal batch calls: ${batchCalls}, Final pagesRead: ${pagesRead}`);
console.log(`Problem: If page has no matches, onBatch is not called!`);
