module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  // Optional if using Babel or TypeScript
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest' // or 'ts-jest' for TypeScript
  }
};
