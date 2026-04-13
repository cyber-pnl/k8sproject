# TODO: Improve main.yml Workflow for Service Tests

## Steps:
- [x] Update .github/workflows/main.yml with enhanced test job (matrix for auth-service/user-service, coverage collection, artifacts upload)
- [x] Fix YAML indentation in deploy job
- [x] Update jest.config.js for both services: Add JUnit reporter, json-summary for CI
- [x] Installed jest-junit deps in auth/user services
- [x] Commit and push changes to trigger workflow (user can do this)
- [ ] Verify in GitHub Actions: Tests pass, coverage artifacts available
- [ ] Test locally: cd services/auth-service && npm test; same for user-service
- [ ] Extend tests for gateway-service/frontend-service and update matrix
- [ ] Optional: Add Codecov integration, JUnit reporters for GH summaries

Progress: Starting edits...
