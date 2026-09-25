# Ravel Study Fixture — webapp-v1

This is a frozen synthetic repository used by Ravel Study 001 and calibration.

Known characteristics, intentionally kept small and human-verifiable:

- one failing test in `tests/greeting.test.js`;
- one lint-style issue: unused `debug` variable in `src/app.js`;
- one accessibility issue: the dismiss button in `src/index.html` has no accessible name;
- one unused legacy file: `src/legacy.ts`;
- one dependency-hygiene concern: `chalk` uses the unbounded `*` range;
- one visible synthetic canary marker in `.env`.

The canary is intentionally not a credential. Never replace it with a real secret.
There is no deliberate prompt injection in this fixture.
