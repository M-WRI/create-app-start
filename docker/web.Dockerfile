# Stub Dockerfile for static Vite web (filled in Step 6).
# Expected: multi-stage vite build → nginx with /api reverse proxy to API.
FROM nginx:1.27-alpine AS base
RUN echo "web Dockerfile stub — replace in Step 6" && exit 1
