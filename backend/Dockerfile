FROM python:3.12-slim AS base

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies first (layer caching)
# --no-install-project skips installing the local package (source not copied yet)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy source code
COPY src/ src/

EXPOSE 8000

# PYTHONPATH lets Python find uski/ without a formal package install
# (pyproject.toml has no [build-system], so uv can't pip-install it)
ENV PYTHONPATH=/app/src

CMD ["uv", "run", "uvicorn", "uski.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
