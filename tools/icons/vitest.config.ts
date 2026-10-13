import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'icons',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
