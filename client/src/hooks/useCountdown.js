import { useEffect, useRef, useState } from 'react';

/**
 * Counts down to a server deadline. `serverTime` (ISO string returned with the
 * deadline) corrects for a skewed client clock. Uses absolute timestamps, so
 * reloads and throttled background timers never drift.
 */
export const useCountdown = (deadline, serverTime, onExpire) => {
  const offsetRef = useRef(0);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (serverTime) offsetRef.current = new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);

  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return undefined;
    }
    expiredRef.current = false;
    const end = new Date(deadline).getTime();
    const tick = () => {
      const left = Math.max(0, Math.round((end - (Date.now() + offsetRef.current)) / 1000));
      setRemaining(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline]);

  return remaining;
};
