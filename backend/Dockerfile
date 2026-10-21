FROM python:3.12-slim

# 国内网络加速：pip 和 uv 都走清华源
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple

WORKDIR /app

RUN pip install --no-cache-dir uv

# 先拷依赖清单再装依赖：只要这两个文件没变，这层直接用缓存，改代码重建会快很多
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY scripts ./scripts

EXPOSE 8000
# 直接用 venv 里的 uvicorn: 避免每次启动 uv run 重新 sync (可能触发联网装包)
CMD [".venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
