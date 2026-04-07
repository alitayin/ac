// Simulate the actual flow
let pagesRead = 0;
const targetCount = 600;
const pageSize = 200;

// Simulate fetching with callback
function simulateFetch() {
  let result = [];
  
  for (let page = 0; page < 10; page++) {
    // Simulate getting 200 transactions per page
    const batch = Array(100).fill(null); // Assume 100 matches per page
    
    // onBatch callback
    pagesRead = page + 1;
    console.log(`Page ${page}: pagesRead = ${pagesRead}, result.length = ${result.length}`);
    
    result.push(...batch);
    
    // Check stop conditions
    const reachedTarget = result.length >= targetCount;
    if (reachedTarget) {
      console.log(`Reached target at page ${page}, result.length = ${result.length}`);
      break;
    }
  }
  
  return result;
}

const result = simulateFetch();
console.log(`\nFinal: pagesRead = ${pagesRead}, result.length = ${result.length}`);
console.log(`pagesRead >= 3? ${pagesRead >= 3}`);
