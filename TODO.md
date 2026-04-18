# Gateway Tests Fixed ✅
# Dockerfiles Fix (User Feedback)
## Steps:
1. [ ] Rewrite services/auth-service/Dockerfile (standard multi-stage, COPY package*.json, npm ci --production, bcrypt support).
2. [ ] Rewrite services/user-service/Dockerfile.
3. [ ] Rewrite services/gateway-service/Dockerfile.
4. [ ] Rewrite services/frontend-service/Dockerfile (views/public).
5. [ ] Test: docker build -t test . in each services/* dir.
6. [ ] Update TODO.md complete.

