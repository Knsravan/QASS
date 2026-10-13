import React, { useMemo } from 'react';
import katex from 'katex';

// KaTeX rendered straight from the app's own KaTeX. (react-katex pinned an
// older KaTeX of its own, with a known advisory; these two components are all
// of it the app used.) A formula that fails to parse shows in KaTeX's error
// colour instead of throwing, so a typo can't take a module down.
function useKatexHtml(math, displayMode) {
  return useMemo(
    () => katex.renderToString(String(math ?? ''), { displayMode, throwOnError: false }),
    [math, displayMode],
  );
}

export function InlineMath({ math }) {
  const html = useKatexHtml(math, false);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function BlockMath({ math }) {
  const html = useKatexHtml(math, true);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
