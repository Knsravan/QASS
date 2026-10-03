import { useEffect, useState } from 'react';

/** True while `show` is on and for `ms` after it turns off (time to play an exit). */
export function useExitPresence(show, ms) {
  const [mounted, setMounted] = useState(show);
  useEffect(() => {
    if (show) { setMounted(true); return undefined; }
    const id = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(id);
  }, [show, ms]);
  return show || mounted;
}
