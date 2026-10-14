"""支持 python -m app.mcp 直接启动 (内容在包 __init__.py)"""
from app.mcp import main

if __name__ == "__main__":
    import anyio
    import sys

    try:
        anyio.run(main)
    except KeyboardInterrupt:
        sys.exit(0)
