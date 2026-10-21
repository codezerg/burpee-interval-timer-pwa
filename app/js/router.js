// Screen navigation. `route` is a van state; the app root re-renders the
// screen when it changes. One extra browser-history entry lets the phone's
// Back button/gesture go back inside the app instead of closing it.

import van from 'vanjs-core';

let stack = [{ name: 'home', params: {} }];
export const route = van.state(stack[0]);
export const top = () => stack[stack.length - 1];

let guarded = false;
let backHandler = () => pop();

function show() {
  route.val = top();
  window.scrollTo(0, 0);
  if (stack.length > 1 && !guarded) {
    history.pushState({ guard: true }, '');
    guarded = true;
  }
}

export function go(name, params = {}) {
  stack.push({ name, params });
  show();
}

export function replace(name, params = {}) {
  stack[stack.length - 1] = { name, params };
  show();
}

export function resetTo(name, params = {}) {
  stack = [{ name, params }];
  show();
}

export function pop() {
  if (stack.length > 1) {
    stack.pop();
    show();
  }
}

// In-app back buttons and the phone's Back go through the same handler,
// so the app can say no (e.g. during a workout).
export const back = () => backHandler();
export function onBack(fn) { backHandler = fn; }

window.addEventListener('popstate', () => {
  guarded = false;
  backHandler();
  if (stack.length > 1 && !guarded) {
    history.pushState({ guard: true }, '');
    guarded = true;
  }
});
