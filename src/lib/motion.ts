type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition: () => void;
  };
};

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function runRouteTransition(callback: () => void) {
  if (typeof document === 'undefined' || prefersReducedMotion()) {
    callback();
    return;
  }

  const viewTransition = (document as ViewTransitionDocument).startViewTransition;

  if (!viewTransition) {
    callback();
    return;
  }

  // 지원 브라우저에서는 화면 교체 순간의 이전/다음 DOM을 함께 캡처해 부드러운 crossfade를 만든다.
  viewTransition.call(document, callback);
}
