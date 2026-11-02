import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader on mount (and when deps change) with loading/error
 * state, ignoring results that arrive after unmount or a newer request.
 */
export const useAsync = (loader, deps = []) => {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const requestId = useRef(0);

  const run = useCallback(async () => {
    requestId.current += 1;
    const id = requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (id === requestId.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (id === requestId.current) setState({ data: null, error, loading: false });
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => {
      requestId.current += 1;
    };
  }, [run]);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
};

export const useDocumentTitle = (title) => {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · MockVue` : 'MockVue — Mock interviews with real feedback';
    return () => {
      document.title = previous;
    };
  }, [title]);
};
