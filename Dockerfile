FROM python:3.12-slim@sha256:09f7da3bc104798d0afb40bc08d23ab2da20a76130cec1f2ef170848f5d85217

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && adduser --disabled-password --gecos '' appuser \
    && mkdir -p /app/poker_data \
    && chown -R appuser:appuser /app

COPY --chown=appuser:appuser backend backend
COPY --chown=appuser:appuser frontend frontend
COPY --chown=appuser:appuser version.txt .

USER appuser
EXPOSE 5000
VOLUME ["/app/poker_data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '5000') + '/', timeout=3)"

CMD ["gunicorn", "--chdir", "backend", "--bind", "0.0.0.0:5000", "--workers", "1", "--access-logfile", "-", "--error-logfile", "-", "run:create_production_app()"]
