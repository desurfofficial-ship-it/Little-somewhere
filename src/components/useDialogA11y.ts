import React, { useEffect, useRef } from 'react';

/**
 * UI/UX program (WP3) — dialog focus kit.
 *
 * One shared behavior for every game surface with `role="dialog"`:
 *  1. On open, moves focus into the surface (heading wrapper first, else the
 *     first focusable element) so keyboard and screen-reader users land inside
 *     the context they just opened.
 *  2. Traps Tab/Shift+Tab inside the surface while open — focus can no longer
 *     wander onto HUD controls hidden behind an espresso backdrop (the old
 *     chain let keyboard users reach the unconfirmed world-reset buttons).
 *  3. Restores focus to the triggering element on close.
 *
 * Usage: attach the returned ref to the `role="dialog"` element and pass the
 * open state. Pure UI behavior — no game-layer imports, no persistence.
 */
export function useDialogA11y(
  surfaceRef: React.RefObject<HTMLElement | null>,
  open: boolean,
): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const surface = surfaceRef.current;
    if (!surface) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Focus the surface itself (it carries the accessible name via aria-label);
    // make it programmatically focusable for this purpose without joining the
    // tab order permanently.
    const previousTabindex = surface.getAttribute('tabindex');
    if (previousTabindex === null) surface.setAttribute('tabindex', '-1');
    surface.focus({ preventScroll: true });

    const FOCUSABLE_SELECTOR =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) {
        event.preventDefault();
        surface.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const currentIdx = current ? focusable.indexOf(current) : -1;
      let next: HTMLElement;
      if (event.shiftKey) {
        next = currentIdx <= 0 ? last : focusable[currentIdx - 1] ?? last;
      } else {
        next =
          currentIdx === -1 || currentIdx >= focusable.length - 1
            ? first
            : focusable[currentIdx + 1] ?? first;
      }
      event.preventDefault();
      next.focus();
    };

    surface.addEventListener('keydown', handleKeyDown);

    return () => {
      surface.removeEventListener('keydown', handleKeyDown);
      if (previousTabindex === null) surface.removeAttribute('tabindex');
      const restore = previouslyFocusedRef.current;
      if (restore && document.contains(restore)) {
        restore.focus({ preventScroll: true });
      }
    };
  }, [open, surfaceRef]);
}
