import '@testing-library/jest-dom'

// Mock localStorage with actual storage
const storage: Record<string, string> = {}

const localStorageMock = {
  getItem: (key: string) => storage[key] || null,
  setItem: (key: string, value: string) => {
    storage[key] = value
  },
  removeItem: (key: string) => {
    delete storage[key]
  },
  clear: () => {
    Object.keys(storage).forEach(key => delete storage[key])
  },
  key: (index: number) => {
    const keys = Object.keys(storage)
    return keys[index] || null
  },
  get length() {
    return Object.keys(storage).length
  },
}

global.localStorage = localStorageMock as any

// Reset storage before each test
beforeEach(() => {
  Object.keys(storage).forEach(key => delete storage[key])
})
