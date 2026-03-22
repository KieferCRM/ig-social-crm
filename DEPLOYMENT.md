# Production Deployment

Primary checklist:
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

Fast path commands:

```bash
npm run preflight:env:solo-prod
npm run typecheck
npm run lint
npm run build
npm run smoke:solo
npm run smoke:receptionist
```

If any check fails, do not promote the release.
