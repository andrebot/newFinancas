import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount everything rendered by a test so tests never share DOM state.
afterEach(cleanup);
