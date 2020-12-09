module.exports = require('@darkobits/ts').jest({
  coverageThreshold: {
    global: {
      branches: 89,
      lines: 95,
      statements: 95
    }
  }
});
