export function greeting(name) {
  const debug = true;
  return `Hello ${name}`;
}

export function renderGreeting(name) {
  return `<p>${greeting(name)}</p>`;
}
