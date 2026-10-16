import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';

// Shared fakes for an Experience's integration test (X3, X4): the stub that
// stands in for each Flow or Interaction it composes, a `fetch` answering by
// method and path, and the waits that let the API client's answers reach the
// page.

/** A stub's props. */
export interface StubProps {
  readonly name: string;
  /** Props worth asserting on, shown as JSON. */
  readonly shows?: unknown;
  /** Buttons that make a request and show its outcome. */
  readonly requests?: Readonly<Record<string, () => Promise<unknown>>>;
  /** Buttons that only emit. */
  readonly events?: Readonly<Record<string, () => void>>;
}

/**
 * Stands in for a Flow or Interaction: one button per request or event, and
 * the last outcome the Experience answered.
 *
 * @param props - The stub's name, what it shows and its buttons.
 * @returns The stub.
 */
export function Stub({
  name, shows, requests = {}, events = {},
}: StubProps) {
  const [outcome, setOutcome] = useState<unknown>();
  return (
    <div data-testid={name} data-shows={JSON.stringify(shows)}>
      {Object.entries(requests).map(([label, request]) => (
        <button key={label} type="button" onClick={async () => setOutcome(await request())}>
          {label}
        </button>
      ))}
      {Object.entries(events).map(([label, emit]) => (
        <button key={label} type="button" onClick={emit}>{label}</button>
      ))}
      <output data-testid={`${name}-outcome`}>{outcome ? JSON.stringify(outcome) : ''}</output>
    </div>
  );
}

/** A canned answer per `METHOD path`; a function so each call gets a fresh body. */
export type Answers = Readonly<Record<string, () => Response | Promise<Response>>>;

/**
 * Builds a fake `fetch` answering each method and path from a table.
 *
 * @param answers - The answer per `METHOD path` (after `/api/v1`).
 * @returns The fake; a call the table doesn't answer throws.
 */
export const fakeFetch = (answers: Answers) => vi.fn<typeof fetch>(async (input) => {
  const request = input as Request;
  const route = `${request.method} ${new URL(request.url).pathname.replace('/api/v1', '')}`;
  const answer = answers[route];
  if (!answer) throw new Error(`No answer for ${route}`);
  return answer();
});

/**
 * Lists the calls `fetch` got, with their bodies.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns Each call's method, path and parsed body (if any).
 */
export const sent = async (fetchFn: ReturnType<typeof fakeFetch>) => Promise.all(
  fetchFn.mock.calls.map(async ([input]) => {
    const request = input as Request;
    const text = await request.clone().text();
    return {
      route: `${request.method} ${new URL(request.url).pathname}`,
      body: text ? JSON.parse(text) as unknown : undefined,
    };
  }),
);

/**
 * Lets every answer `fetch` already has reach the page. The API client hands
 * each one on over a few turns of the event loop, and the store tells React
 * about RTK Query's answers only on the next animation frame (its default
 * auto-batching), so this waits for one.
 */
export const settle = async () => {
  await act(async () => {
    await new Promise((done) => {
      requestAnimationFrame(() => setTimeout(done, 0));
    });
  });
};

/**
 * Builds a response the test sends when it chooses.
 *
 * @returns The response's promise and its resolver.
 */
export const deferred = () => {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((answer) => {
    resolve = answer;
  });
  return { promise, resolve };
};

/**
 * Sends a held response, then lets it reach the page.
 *
 * @param pending - The held response.
 * @param response - What it answers.
 */
export const settleWith = async (pending: ReturnType<typeof deferred>, response: Response) => {
  pending.resolve(response);
  await settle();
};

/**
 * Presses a stub's button and waits for what it started.
 *
 * @param label - The button's label.
 */
export const press = async (label: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: label }));
  });
  await settle();
};

/**
 * Reads what a stub was given.
 *
 * @param name - The stub.
 * @returns Its shown props.
 */
export const shownBy = (name: string) => (
  JSON.parse(screen.getByTestId(name).dataset.shows ?? 'null') as unknown
);

/**
 * Reads the last outcome a stub got.
 *
 * @param name - The stub.
 * @returns The outcome.
 */
export const outcomeOf = (name: string) => (
  JSON.parse(screen.getByTestId(`${name}-outcome`).textContent ?? '') as unknown
);
