FROM node:20-alpine AS dashboard-build

WORKDIR /web

COPY app/web/package.json app/web/tsconfig.json app/web/vite.config.ts app/web/tailwind.config.js app/web/postcss.config.js app/web/index.html ./
COPY app/web/src ./src

RUN npm install
RUN npm run build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

COPY --from=dashboard-build /web/dist /app/app/web/dist

EXPOSE 8000

CMD ["python", "main.py"]
