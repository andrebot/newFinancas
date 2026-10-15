import { useEffect, useState } from 'react';
import { loadPasswordStrengthEstimator, type PasswordStrengthEstimator } from './passwordStrength';

// PasswordStrengthUtility's React side: every screen that picks a new password
// (register, reset, change) loads the estimator when it opens and shows the
// meter once it has. The bundle splits at the load, so the screen never waits.

/**
 * Loads the strength estimator once, for as long as the caller is mounted.
 *
 * @returns The estimator, or `undefined` until it has loaded.
 */
const usePasswordStrengthEstimator = () => {
  const [estimate, setEstimate] = useState<PasswordStrengthEstimator | undefined>();

  useEffect(() => {
    let mounted = true;
    loadPasswordStrengthEstimator().then((estimator) => {
      if (mounted) setEstimate(() => estimator);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return estimate;
};

export default usePasswordStrengthEstimator;
