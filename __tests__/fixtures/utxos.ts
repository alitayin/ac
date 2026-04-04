// Empty UTXO array
export const utxosEmpty: any[] = []

// Single UTXO
export const utxosSingle = [{ value: 1000 }]

// Three distinct UTXOs
export const utxosThreeDistinct = [
  { value: 1000 },
  { value: 2000 },
  { value: 3000 },
]

// Five UTXOs
export const utxosFive = [
  { value: 1000 },
  { value: 1000 },
  { value: 1000 },
  { value: 1000 },
  { value: 1000 },
]

// Seven UTXOs
export const utxosSeven = [
  { value: 1000 },
  { value: 1000 },
  { value: 1000 },
  { value: 1000 },
  { value: 1000 },
  { value: 1000 },
  { value: 1000 },
]

// Two UTXOs
export const utxosTwo = [
  { value: 1000 },
  { value: 1000 },
]

// One hundred UTXOs (large count)
export const utxosHundred = Array.from({ length: 100 }, (_, i) => ({ value: 1000 + i }))
