module.exports = require('@darkobits/ts-unified/dist/config/jest')({
  coverageThreshold: {
    global: {
      branches: 89,
      lines: 95,
      statements: 95
    }
  }
});
