# --- Builder: resolve dependencies with Poetry, export a locked wheel set ---
FROM python:3.12-slim AS builder

RUN pip install --no-cache-dir poetry==1.8.3
WORKDIR /app

COPY services/api/pyproject.toml services/api/poetry.lock* ./
RUN poetry config virtualenvs.create false \
    && poetry install --only main --no-root --no-interaction --no-ansi

# --- Runtime: slim image, non-root user ---
FROM python:3.12-slim AS runtime

RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY services/api/ .
COPY infra/scripts /app/infra/scripts
COPY db /app/db

RUN chown -R app:app /app
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["sh", "-c", "python /app/infra/scripts/migrate.py && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
