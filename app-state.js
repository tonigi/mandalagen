// Shared settings are the source of truth. Controls render state and dispatch patches.
export function createAppState() {
  let value = Object.freeze({
    activeTab: 'image', palette: 'purple', symmetry: 'c6-mirror-vertex',
    seed: 'mandala-random-001', motif: 'auto', contrast: 6, whiteness: 4,
  });
  const listeners = new Set();
  return {
    get value() { return value; },
    set(patch) {
      const previous = value;
      if (Object.keys(patch).every(key => patch[key] === value[key])) return;
      value = Object.freeze({ ...value, ...patch });
      for (const listener of listeners) listener(value, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(value, value);
      return () => listeners.delete(listener);
    },
  };
}
