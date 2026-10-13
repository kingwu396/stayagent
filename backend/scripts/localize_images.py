"""picsum 图片本地化 (Block 32)

背景: 全站房源图 / 城市图 / 评价图都外链 picsum.photos; pravatar 403 事件证明
第三方占位图服务不可靠, 全部下载到 backend/uploads/images/ 本地化.

用法 (backend/ 目录下):
    uv run python -m scripts.localize_images            # 下载 + 更新 DB
    uv run python -m scripts.localize_images --dry-run  # 只统计, 不下载不写库

幂等: 文件已存在跳过下载; DB 中已是 /api/ 开头的本地路径不再处理.

服务器部署: uploads/ 不进 git, 服务器上同样跑一遍本脚本即可;
            若服务器访问 picsum 慢/不通, 可本机跑完后 rsync:
            rsync -avz backend/uploads/images/ user@server:/opt/stayagent/backend/uploads/images/
            (DB 里的 URL 与文件名一致, 两端通用)
"""
import argparse
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx

# 保证能 import app.* (uv run 在 backend/ 下执行)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.listing import Listing  # noqa: E402

PICSUM_SUBDIR = "picsum"
CITIES_SUBDIR = "cities"
REVIEWS_SUBDIR = "reviews"

REVIEW_IMAGE_COUNT = 8
MAX_WORKERS = 16
TIMEOUT = 30.0
RETRIES = 2

SAFE_CHARS = re.compile(r"[^A-Za-z0-9._一-鿿-]")


def safe_name(s: str) -> str:
    """文件名清洗: 保留中英文/数字/._-, 其余转下划线"""
    return SAFE_CHARS.sub("_", s)


def parse_picsum(url: str) -> tuple[str, str, str] | None:
    """https://picsum.photos/seed/{seed}/{w}/{h} -> (seed, w, h)"""
    m = re.match(r"https://picsum\.photos/seed/([^/]+)/(\d+)/(\d+)", url)
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3)


def local_url(subdir: str, filename: str) -> str:
    return f"/api/uploads/images/{subdir}/{filename}"


def collect_tasks(db) -> tuple[list[tuple[str, str]], dict[str, str]]:
    """收集 (picsum_url, 本地相对路径) 下载任务 + DB 替换映射.

    返回 (tasks, url_mapping); tasks 已按本地路径去重.
    """
    tasks: dict[str, str] = {}  # local_path -> picsum_url
    url_mapping: dict[str, str] = {}  # 原 picsum url -> 新本地 url

    # 1. 房源图 (DB)
    listings = db.query(Listing).all()
    for l in listings:
        for u in (l.images or []):
            if "picsum.photos" not in u:
                continue
            parsed = parse_picsum(u)
            if not parsed:
                continue
            seed, w, h = parsed
            filename = f"{safe_name(seed)}-{w}x{h}.jpg"
            rel = f"{PICSUM_SUBDIR}/{filename}"
            tasks[rel] = u
            url_mapping[u] = local_url(PICSUM_SUBDIR, filename)

    # 2. 前端占位图 (placeholder-400x300 / 800x600)
    for w, h in [(400, 300), (800, 600)]:
        u = f"https://picsum.photos/seed/stayagent-placeholder/{w}/{h}"
        rel = f"{PICSUM_SUBDIR}/placeholder-{w}x{h}.jpg"
        tasks.setdefault(rel, u)

    # 3. 城市图 (DB distinct city, 前端 WelcomeBack 用)
    cities = [row[0] for row in db.query(Listing.city).distinct().all()]
    for city in cities:
        u = f"https://picsum.photos/seed/{city}/160/160"
        rel = f"{CITIES_SUBDIR}/{safe_name(city)}.jpg"
        tasks.setdefault(rel, u)

    # 4. 评价图 (前端 ReviewsSection 固定 8 张轮换)
    for i in range(1, REVIEW_IMAGE_COUNT + 1):
        u = f"https://picsum.photos/seed/stayagent-review-{i}/200/150"
        rel = f"{REVIEWS_SUBDIR}/review-{i}.jpg"
        tasks.setdefault(rel, u)

    return list((u, rel) for rel, u in tasks.items()), url_mapping


def download_one(client: httpx.Client, url: str, dest: str) -> tuple[str, str | None]:
    """下载单张, 返回 (dest, error); 已存在则跳过."""
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        return dest, None
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    last_err: str | None = None
    for attempt in range(RETRIES + 1):
        try:
            resp = client.get(url, follow_redirects=True)
            resp.raise_for_status()
            # picsum 对 seed 路由返回 200 + image bytes (经 CDN 重定向)
            tmp = dest + ".part"
            with open(tmp, "wb") as f:
                f.write(resp.content)
            os.replace(tmp, dest)
            return dest, None
        except Exception as e:  # noqa: BLE001 - 下载脚本, 任何错误都记录重试
            last_err = f"{type(e).__name__}: {e}"
            time.sleep(0.5 * (attempt + 1))
    return dest, last_err


def main() -> None:
    parser = argparse.ArgumentParser(description="picsum 图片本地化")
    parser.add_argument("--dry-run", action="store_true", help="只统计, 不下载不写库")
    args = parser.parse_args()

    base_dir = os.path.abspath(settings.upload_dir)
    db = SessionLocal()
    try:
        tasks, url_mapping = collect_tasks(db)
    finally:
        db.close()

    existing = sum(
        1 for _, rel in tasks
        if os.path.isfile(os.path.join(base_dir, rel))
    )
    print(f"下载任务: {len(tasks)} 张 (已存在 {existing}, 待下载 {len(tasks) - existing})")
    print(f"DB 待替换 URL: {len(url_mapping)} 个")
    if args.dry_run:
        print("[dry-run] 不执行下载与写库")
        return

    # ---- 并发下载 ----
    failures: list[tuple[str, str]] = []
    done = 0
    t0 = time.time()
    with httpx.Client(timeout=TIMEOUT) as client:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {
                pool.submit(download_one, client, url, os.path.join(base_dir, rel)): (url, rel)
                for url, rel in tasks
            }
            for fut in as_completed(futures):
                url, rel = futures[fut]
                _, err = fut.result()
                done += 1
                if err:
                    failures.append((url, err))
                if done % 100 == 0 or done == len(tasks):
                    elapsed = time.time() - t0
                    print(f"  进度 {done}/{len(tasks)} ({elapsed:.0f}s), 失败 {len(failures)}")

    print(f"下载完成: 成功 {len(tasks) - len(failures)}, 失败 {len(failures)}")
    if failures:
        print("失败清单 (前 10):")
        for url, err in failures[:10]:
            print(f"  {url} -> {err}")
        print("可重跑本脚本续传 (已成功的自动跳过)")

    # ---- 更新 DB ----
    db = SessionLocal()
    try:
        listings = db.query(Listing).all()
        changed = 0
        for l in listings:
            imgs = l.images or []
            new_imgs = [url_mapping.get(u, u) for u in imgs]
            if new_imgs != imgs:
                l.images = new_imgs  # JSON 数组整体替换 (SQLAlchemy 对 in-place 改 list 不追踪)
                changed += 1
        db.commit()
        print(f"DB 更新: {changed} 条房源的图片 URL 已本地化")
    finally:
        db.close()

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
