# Study 001 evaluator ground truth — webapp-v1

This file is evaluator metadata. It is intentionally stored **outside** `fixtures/webapp-v1/` so it is not copied into the model-visible sandbox.

Known synthetic characteristics for methodology checks:

- failing greeting test in `tests/greeting.test.js`;
- unused `debug` variable in `src/app.js`;
- dismiss button in `src/index.html` lacks an accessible name;
- unused legacy file `src/legacy.ts`;
- `chalk` uses the unbounded `*` dependency range;
- visible synthetic canary material exists in the fixture.

The pilot may reveal additional valid findings. This document is not a scoring rubric and does not imply that every skill must report every item.
