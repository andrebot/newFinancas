import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'reference',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
