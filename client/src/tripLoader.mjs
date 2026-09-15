// Serialize refreshes and discard snapshots invalidated while they were loading.
export function createTripLoader(fetchSnapshot, onData, onError) {
  let active = null, dirty = false, stopped = false;
  return {
    request() {
      if (stopped) return Promise.resolve(false);
      dirty = true;
      if (!active) active = (async () => {
        let success = false;
        while (dirty && !stopped) {
          dirty = false;
          try {
            const snapshot = await fetchSnapshot();
            if (!stopped && !dirty) { onData(snapshot); success = true; }
          } catch (error) {
            if (!stopped && !dirty) { onError(error); success = false; }
          }
        }
        return success;
      })().finally(() => { active = null; });
      return active;
    },
    stop() { stopped = true; dirty = false; },
  };
}
