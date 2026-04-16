// Global test setup
jest.setTimeout(10000);

// Mock console.error to reduce noise
jest.spyOn(console, 'error').mockImplementation(() => {});
