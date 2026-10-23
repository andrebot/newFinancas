import { useState, type Dispatch, type SetStateAction } from 'react';

// A setup tab once opened stays mounted while another is shown (OQ-197), but
// a drawer renders in a portal, outside the hidden tab: left open, its scrim
// and focus trap would sit over the section the address moved to (Back, a
// link). So a Flow with drawers closes them as its tab is hidden, and shows
// none until it is open again. A drawer whose request is out can't close; it
// stays in the Flow's state, unseen, so a failure's banner is there when the
// tab comes back.

/**
 * Closes a Flow's open drawer at the moment its tab is hidden — once, so a
 * drawer kept by a request that was out survives its answer. The change is
 * applied as the Flow renders, so the drawer is closed before it paints.
 *
 * @param active - Whether the Flow's tab is the open one.
 * @param setState - The Flow's state setter.
 * @param drawerClosed - The Flow's own close transition (a no-op while a request is out).
 */
const useDrawerClosedOnHide = <State>(
  active: boolean,
  setState: Dispatch<SetStateAction<State>>,
  drawerClosed: (current: State) => State,
) => {
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setState(drawerClosed);
  }
};

export default useDrawerClosedOnHide;
