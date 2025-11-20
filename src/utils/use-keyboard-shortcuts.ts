import { useCallback, useEffect } from "react";

const useKeyboardShortcuts = (
  key: string,
  callback: () => void,
  deps: readonly unknown[] = [],
) => {
  const memoizedCallback = useCallback(callback, [callback, ...deps]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        event.stopPropagation();
        memoizedCallback();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [key, memoizedCallback]);
};

export { useKeyboardShortcuts };
