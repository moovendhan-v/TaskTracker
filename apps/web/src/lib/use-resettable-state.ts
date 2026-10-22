import { useState, type Dispatch, type SetStateAction } from 'react';

/**
 * A local, editable copy of `source` that starts over whenever `source` changes,
 * e.g. an input that holds a draft of a field until the server sends a new value.
 * Adjusts state during render (https://react.dev/learn/you-might-not-need-an-effect)
 * instead of in an effect, so there's no extra render with the stale value.
 */
export function useResettableState<T>(source: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(source);
  const [previousSource, setPreviousSource] = useState(source);
  if (!Object.is(source, previousSource)) {
    setPreviousSource(source);
    setValue(source);
  }
  return [value, setValue];
}
