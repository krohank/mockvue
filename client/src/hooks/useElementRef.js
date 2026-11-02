import { useMemo, useState } from 'react';

/**
 * A callback ref that also behaves like a ref object (`ref.current`) and
 * exposes the element as state, so effects re-run when the DOM node changes
 * (e.g. a <video> unmounted in one layout and remounted in another).
 */
export const useElementRef = () => {
  const [element, setElement] = useState(null);
  const ref = useMemo(() => {
    const callback = (node) => {
      callback.current = node;
      setElement(node);
    };
    callback.current = null;
    return callback;
  }, []);
  return [ref, element];
};
