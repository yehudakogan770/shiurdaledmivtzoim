/**
 * Locks the page in place while a pop-up or the phone menu is open (iPhones ignore
 * overflow:hidden alone), and unlocks it when the last one closes. Shared, so two of them
 * closing at the same moment (the menu and a pop-up, after switching accounts) can never leave
 * the page stuck: the lock is counted, and the last unlock always clears it fully.
 */
let count = 0;
let savedY = 0;

export function lockPage() {
  if (typeof document === "undefined") return () => {};
  const { body, documentElement: html } = document;
  if (count++ === 0) {
    savedY = window.scrollY;
    Object.assign(body.style, { position: "fixed", top: `-${savedY}px`, left: "0", right: "0", width: "100%", overflow: "hidden" });
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--count > 0) return;
    count = 0;
    for (const k of ["position", "top", "left", "right", "width", "overflow"] as const) body.style[k] = "";
    html.style.overflow = "";
    html.style.overscrollBehavior = "";
    window.scrollTo(0, savedY);
  };
}
