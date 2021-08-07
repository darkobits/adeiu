import { jest } from '@darkobits/ts';

export default jest({
  coverageThreshold: {
    global: {
      branches: 89,
      lines: 95,
      statements: 95
    }
  }
});
