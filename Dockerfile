FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY frontend/ ./
ENV REACT_APP_BACKEND_URL="" GENERATE_SOURCEMAP=false
RUN CI=true DISABLE_EMERGENT_OVERLAY=true npm test -- --watchAll=false --runInBand && npm run build

FROM python:3.12-slim-bookworm
WORKDIR /app/backend
COPY backend/requirements-cloud.txt ./
RUN pip install --no-cache-dir -r requirements-cloud.txt
COPY backend/ ./
COPY --from=frontend /build/build /app/frontend/build
ENV PYTHONUNBUFFERED=1 STORAGE_BACKEND=local STORAGE_LOCAL_ROOT=/var/data/objects SEED_DEMO_ACCOUNTS=false
EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn cloud_app:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
