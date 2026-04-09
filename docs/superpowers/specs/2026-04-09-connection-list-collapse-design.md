# Connection List Collapse Design

## Goal

When a database connection is successfully opened, automatically collapse the connection list to reclaim horizontal space while keeping the object browser visible. Users can manually expand or collapse the connection list afterward through an inline edge control.

## Scope

- Only collapse the `ConnectionListPanel`
- Keep `ObjectBrowser` visible after a connection is selected
- Add a narrow edge toggle between the connection list and object browser
- Automatically collapse once after a successful connection
- Force the connection list open when no connection is selected

## Out of Scope

- Collapsing the entire left workspace sidebar
- Persisting the collapse preference across reloads
- Adding a second collapse trigger in the icon sidebar

## Interaction

1. User selects a connection
2. If connection succeeds and the current sidebar view is `connections`, collapse the connection list
3. The object browser remains visible
4. User can click the edge arrow to expand or collapse the connection list manually
5. If the active connection is cleared, the connection list expands automatically

## Implementation Notes

- Keep collapse state in `App.tsx`
- Extract the connection sidebar layout into a focused renderer component so the collapse boundary is isolated from the rest of `App`
- Use a small pure helper to keep the auto-collapse rules testable
- Cover the behavior with renderer-level tests before wiring the UI
