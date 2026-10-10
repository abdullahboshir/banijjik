## Summary

<!-- What changed and why, in two or three lines. -->

## Card

- Card id: <!-- e.g. 0.4a -->
- Plan: <!-- link to docs/plans/<card>.md -->
- Handoff: <!-- link to docs/handoffs/<card>.md -->

## Definition of Done

- [ ] API, validation, permission, entitlement and tenant/location enforcement are in place
- [ ] Tests cover the happy path, a validation error, permission denied and cross-org denied (plus cross-location where relevant)
- [ ] UI is wired to the real API, the mobile layout is checked (screenshots attached for UI changes), BN and EN i18n keys are added
- [ ] No TODO, stub, mock data or commented-out code is presented as finished; known gaps are written in STATUS.md
- [ ] `npm run ci` passes locally
- [ ] `docs/handoffs/<card>.md` is written and only this card's row in `docs/STATUS.md` is updated

## Risk notes

<!-- Migrations, new dependencies, behaviour changes, anything a reviewer should look at first. -->
