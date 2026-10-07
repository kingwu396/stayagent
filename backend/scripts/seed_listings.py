"""Seed listings: 50 cities × 20 = 1000 (Block 14)

Block 14 扩容:
- 10 → 50 城市
- 100 → 1000 房源
- 保留现有 100 条 (10 城 × 10)
- 新增 40 城市 × 20 = 800
- 默认行为: 增量 (add only missing cities) → 最终 ~1000
- --truncate: TRUNCATE 表后重建 (适合 demo / 测试)

图片用 picsum.photos 的 seed 模式, 确定性 + 无需下载.

运行:
  uv run python -m scripts.seed_listings           # 增量
  uv run python -m scripts.seed_listings --truncate  # 全重建 (1000 严格)
"""
import argparse
import random
from decimal import Decimal

from sqlalchemy import select, func, text
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.core.security import hash_password
from app.models import Listing, User

import app.models  # noqa: F401  确保所有模型注册


# ============ 数据池 ============

# 通用 neighborhoods (新城市兜底)
GENERIC_NBRS = ["市中心", "老城区", "滨河区", "山丘区", "港湾"]

# 通用 city keywords (新城市兜底)
GENERIC_KEYWORDS = ["本地咖啡馆", "近地铁", "老城韵味", "历史街区", "中心位置"]

CITIES = [
    # 现有 10 城 (保留)
    ("东京", "日本", 35.6762, 139.6503, ["涩谷", "新宿", "浅草", "六本木", "银座"]),
    ("巴黎", "法国", 48.8566, 2.3522, ["玛黑区", "蒙马特", "圣日耳曼", "拉丁区", "玛黑区"]),
    ("纽约", "美国", 40.7128, -74.0060, ["苏豪区", "威廉斯堡", "上东区", "切尔西", "哈莱姆"]),
    ("伦敦", "英国", 51.5074, -0.1278, ["肖尔迪奇", "诺丁山", "卡姆登", "南岸", "布里克斯顿"]),
    ("曼谷", "泰国", 13.7563, 100.5018, ["素坤逸", "是隆", "唐人街", "阿里", "通罗"]),
    ("巴厘岛", "印度尼西亚", -8.4095, 115.1889, ["乌布", "水明漾", "仓古", "沙努尔", "努沙杜瓦"]),
    ("上海", "中国", 31.2304, 121.4737, ["新天地", "静安", "法租界", "陆家嘴", "徐汇"]),
    ("首尔", "韩国", 37.5665, 126.9780, ["江南", "弘大", "梨泰院", "明洞", "北村"]),
    ("新加坡", "新加坡", 1.3521, 103.8198, ["中峇鲁", "牛车水", "乌节路", "武吉士", "滨海湾"]),
    ("罗马", "意大利", 41.9028, 12.4964, ["特拉斯提弗列", "蒙蒂", "普拉蒂", "泰斯塔乔", "历史中心"]),
    # 新增 40 城 (Block 14)
    # 日本
    ("京都", "日本", 35.0116, 135.7681, ["祇园", "东山", "岚山", "中京"]),
    ("大阪", "日本", 34.6937, 135.5023, ["难波", "梅田", "天王寺", "新世界"]),
    # 中国/港台
    ("北京", "中国", 39.9042, 116.4074, ["三里屯", "王府井", "后海", "国贸"]),
    ("香港", "中国香港", 22.3193, 114.1694, ["中环", "尖沙咀", "旺角", "铜锣湾"]),
    ("台北", "中国台湾", 25.0330, 121.5654, ["西门町", "大安", "师大", "松山"]),
    ("成都", "中国", 30.5728, 104.0668, ["锦里", "春熙路", "宽窄巷子"]),
    # 东南亚
    ("普吉岛", "泰国", 7.8804, 98.3923, ["芭东", "卡塔", "卡伦", "拉威"]),
    ("清迈", "泰国", 18.7883, 98.9853, ["古城", "宁曼路", "昌普"]),
    ("河内", "越南", 21.0285, 105.8542, ["老城区", "还剑湖", "法租界区"]),
    ("胡志明市", "越南", 10.8231, 106.6297, ["第一区", "范五老街", "西贡南"]),
    ("吉隆坡", "马来西亚", 3.1390, 101.6869, ["武吉免登", "双子塔", "茨厂街"]),
    ("马尼拉", "菲律宾", 14.5995, 120.9842, ["马卡蒂", "博尼法西奥堡", "市中市"]),
    ("雅加达", "印度尼西亚", -6.2088, 106.8456, ["苏迪曼", "克芒", "老城区"]),
    # 中东/南亚
    ("迪拜", "阿联酋", 25.2048, 55.2708, ["迪拜市中心", "码头区", "朱美拉棕榈岛", "老迪拜"]),
    ("伊斯坦布尔", "土耳其", 41.0082, 28.9784, ["苏丹阿赫迈特", "贝伊奥卢", "卡德柯伊", "贝西克塔斯"]),
    ("孟买", "印度", 19.0760, 72.8777, ["科拉巴", "班德拉", "朱胡", "波瓦伊"]),
    ("德里", "印度", 28.6139, 77.2090, ["康诺特广场", "豪兹卡斯", "卡罗尔巴格"]),
    # 欧洲
    ("巴塞罗那", "西班牙", 41.3851, 2.1734, ["扩展区", "格拉西亚", "巴塞罗内塔", "哥特区"]),
    ("马德里", "西班牙", 40.4168, -3.7038, ["太阳门", "马拉萨尼亚", "丘埃卡", "萨拉曼卡"]),
    ("阿姆斯特丹", "荷兰", 52.3676, 4.9041, ["约旦区", "德派普", "市中心", "老西区"]),
    ("柏林", "德国", 52.5200, 13.4050, ["米特", "克罗伊茨贝格", "普伦茨劳贝格", "新科尔恩"]),
    ("慕尼黑", "德国", 48.1351, 11.5820, ["老城", "施瓦宾", "格洛克肯巴赫区"]),
    ("维也纳", "奥地利", 48.2082, 16.3738, ["内城", "利奥波德城", "新堡区"]),
    ("布拉格", "捷克", 50.0755, 14.4378, ["老城", "小城", "维诺赫拉迪"]),
    ("里斯本", "葡萄牙", 38.7223, -9.1393, ["阿尔法玛", "上城区", "贝伦", "王子区"]),
    ("雅典", "希腊", 37.9838, 23.7275, ["普拉卡", "蒙纳斯提拉奇", "库卡基", "普西里"]),
    ("佛罗伦萨", "意大利", 43.7696, 11.2558, ["大教堂", "奥尔特拉诺", "圣十字"]),
    ("威尼斯", "意大利", 45.4408, 12.3155, ["圣马可", "卡纳雷吉欧", "多尔索杜罗"]),
    ("米兰", "意大利", 45.4642, 9.1900, ["布雷拉", "纳维利", "新门"]),
    ("苏黎世", "瑞士", 47.3769, 8.5417, ["老城", "尼德多夫", "塞费尔德"]),
    ("日内瓦", "瑞士", 46.2044, 6.1432, ["老城", "帕奎斯", "活水区"]),
    ("爱丁堡", "英国", 55.9533, -3.1883, ["老城", "新城", "利斯"]),
    # 大洋洲
    ("悉尼", "澳大利亚", -33.8688, 151.2093, ["市中心", "萨里山", "邦迪", "新镇"]),
    ("墨尔本", "澳大利亚", -37.8136, 144.9631, ["市中心", "菲茨罗伊", "圣基尔达", "布伦瑞克"]),
    ("奥克兰", "新西兰", -36.8485, 174.7633, ["市中心", "庞森比", "温亚德区"]),
    # 美洲
    ("温哥华", "加拿大", 49.2827, -123.1207, ["市中心", "煤气镇", "耶鲁镇", "基斯兰奴"]),
    ("多伦多", "加拿大", 43.6532, -79.3832, ["市中心", "皇后西街", "古酿酒厂区", "约克维尔"]),
    ("墨西哥城", "墨西哥", 19.4326, -99.1332, ["中心区", "罗马区", "孔德萨", "科约阿坎"]),
    ("布宜诺斯艾利斯", "阿根廷", -34.6037, -58.3816, ["巴勒莫", "圣特尔莫", "雷科莱塔", "贝尔格拉诺"]),
    ("里约热内卢", "巴西", -22.9068, -43.1729, ["科帕卡巴纳", "伊帕内玛", "莱伯伦", "圣特雷莎"]),
]

PROPERTY_TYPES = ["apartment", "house", "villa", "studio", "hotel"]

# DB 存英文键（筛选依赖），生成标题/描述等展示文案时转中文
PROPERTY_TYPE_CN = {
    "apartment": "公寓",
    "house": "民宿",
    "villa": "别墅",
    "studio": "开间",
    "hotel": "酒店",
}

PRICE_RANGES = {
    "studio": (40, 120),
    "apartment": (60, 200),
    "house": (120, 400),
    "villa": (300, 800),
    "hotel": (100, 300),
}

HOST_NAMES = [
    "健一", "美雪", "博", "小樱",
    "皮埃尔", "玛丽", "让", "索菲",
    "麦克", "莎拉", "大卫", "艾玛",
    "阿伟", "小林", "小晨", "阿明",
    "敏俊", "智秀", "秀妍", "惠敏",
    "卢卡", "朱丽娅", "马可", "艾莲娜",
    "阿农", "克里特", "马德", "普特里",
    # Block 14 扩 名字池
    "斯文", "英格丽德", "拉尔斯", "阿斯特丽",
    "卡洛斯", "索菲娅", "迭戈", "露西亚",
    "安德烈", "奥莉加", "德米特里", "娜塔莎",
    "哈桑", "法蒂玛", "奥马尔", "莱拉",
    "拉吉", "普里娅", "阿尔琼", "阿妮卡",
]

TITLE_TEMPLATES = {
    "apartment": [
        "{neighborhood}现代公寓",
        "{neighborhood}温馨公寓",
        "{neighborhood}城景公寓",
    ],
    "house": [
        "{neighborhood}特色民居",
        "{neighborhood}亲子民宿",
        "{neighborhood}带花园宽敞民宿",
    ],
    "villa": [
        "{neighborhood}奢华别墅",
        "{neighborhood}私人泳池别墅",
        "{neighborhood}观景别墅",
    ],
    "studio": [
        "{neighborhood}精巧开间",
        "{neighborhood}时尚工作室",
        "{neighborhood}中心明亮开间",
    ],
    "hotel": [
        "{neighborhood}精品酒店",
        "{neighborhood}现代酒店",
        "{neighborhood}经典酒店",
    ],
}

DESC_SENTENCES = [
    "欢迎来到我们温馨的住处，是探索{city}的理想基地。",
    "坐落于{neighborhood}核心地段，步行即达咖啡馆、餐厅和地铁站。",
    "房间配备舒适床品、设施齐全的厨房和高速无线网络。",
    "在这间精心布置的{type}里，尽享迷人景致与地道本地风情。",
    "步行可达主要景点，地铁出行十分便利。",
    "无论是情侣、家庭还是独自出行，都能住得舒适安心。",
    "近期全新装修，现代设施与本地韵味兼得。",
    "最推荐的是洒满自然光的舒适角落——晨起喝杯咖啡再合适不过。",
]

CITY_KEYWORDS = {
    "东京": ["近地铁", "涩谷十字路口", "传统榻榻米"],
    "巴黎": ["步行到埃菲尔铁塔", "咖啡馆文化", "塞纳河景"],
    "纽约": ["中央公园", "地铁直达", "布鲁克林风情"],
    "伦敦": ["地铁站旁", "酒馆文化", "海德公园"],
    "曼谷": ["BTS 天铁", "街头美食", "临近寺庙"],
    "巴厘岛": ["梯田景观", "海滩俱乐部", "瑜伽馆"],
    "上海": ["外滩景观", "法租界风情", "地铁 2 号线"],
    "首尔": ["弘大夜生活", "江南时尚", "汉江畔"],
    "新加坡": ["熟食中心", "滨海湾", "地铁站旁"],
    "罗马": ["步行到斗兽场", "小餐馆", "复古韵味"],
    # Block 14 补充
    "京都": ["寺庙漫步", "艺伎区", "抹茶咖啡"],
    "大阪": ["章鱼烧小摊", "道顿堀", "大阪烧"],
    "北京": ["胡同漫步", "故宫", "北京烤鸭"],
    "香港": ["天星小轮", "粤式点心", "夜市"],
    "台北": ["夜市", "珍珠奶茶", "临近温泉"],
    "迪拜": ["哈利法塔景观", "沙漠冲沙", "奢侈品购物"],
    "伊斯坦布尔": ["海峡游船", "大巴扎", "土耳其浴"],
    "巴塞罗那": ["圣家堂", "Tapas 小馆", "海滩"],
    "阿姆斯特丹": ["运河游船", "骑行游览", "梵高美术馆"],
    "柏林": ["柏林墙遗址", "科技氛围", "德式香肠"],
    "维也纳": ["咖啡馆", "古典音乐会", "萨赫蛋糕"],
    "布拉格": ["老城广场", "啤酒馆", "天文钟"],
    "悉尼": ["歌剧院景观", "邦迪海滩", "海港大桥"],
}

AMENITY_POOL = [
    "wifi", "kitchen", "washer", "dryer", "air conditioning",
    "heating", "workspace", "pool", "gym", "parking",
    "tv", "coffee maker", "balcony", "garden",
]

AMENITIES_BY_TYPE = {
    "apartment": ["wifi", "kitchen", "washer", "air conditioning", "workspace", "tv", "coffee maker"],
    "house": ["wifi", "kitchen", "washer", "dryer", "parking", "garden", "tv", "heating"],
    "villa": ["wifi", "kitchen", "washer", "dryer", "pool", "parking", "garden", "balcony", "tv"],
    "studio": ["wifi", "kitchen", "air conditioning", "workspace", "coffee maker", "tv"],
    "hotel": ["wifi", "air conditioning", "tv", "gym", "workspace", "coffee maker", "heating"],
}


def random_listing(city: str, country: str, lat: float, lng: float,
                   neighborhoods: list[str], prop_type: str, host_id: int | None = None) -> Listing:
    """生成一条随机房源"""
    neighborhood = random.choice(neighborhoods)
    price_min, price_max = PRICE_RANGES[prop_type]
    price = round(random.uniform(price_min, price_max), 2)

    title_tpl = random.choice(TITLE_TEMPLATES[prop_type])
    title = title_tpl.format(neighborhood=neighborhood)

    desc_parts = random.sample(DESC_SENTENCES, 3)
    keywords = CITY_KEYWORDS.get(city, GENERIC_KEYWORDS)
    if keywords and random.random() > 0.4:
        desc_parts.append(f"本地亮点：{random.choice(keywords)}。")
    description = " ".join(
        p.format(city=city, neighborhood=neighborhood, type=PROPERTY_TYPE_CN[prop_type])
        for p in desc_parts
    )

    lat_off = Decimal(str(round(lat + random.uniform(-0.05, 0.05), 6)))
    lng_off = Decimal(str(round(lng + random.uniform(-0.05, 0.05), 6)))

    pool = AMENITIES_BY_TYPE[prop_type]
    amenities = random.sample(pool, random.randint(3, min(6, len(pool))))

    slug = f"{city.lower()}-{neighborhood.lower().replace(' ', '')}-{prop_type}"
    n_images = random.randint(3, 5)
    images = [
        f"https://picsum.photos/seed/{slug}-{i}/800/600"
        for i in range(n_images)
    ]

    rating = Decimal(str(round(random.uniform(4.0, 5.0), 1)))
    review_count = random.randint(10, 500)

    if prop_type == "studio":
        max_guests = random.choice([1, 2])
        bedrooms = 0
        beds = 1
        bathrooms = 1
    elif prop_type == "apartment":
        max_guests = random.choice([2, 3, 4])
        bedrooms = random.choice([1, 2])
        beds = max_guests
        bathrooms = 1
    elif prop_type == "house":
        max_guests = random.choice([4, 5, 6, 8])
        bedrooms = random.choice([2, 3, 4])
        beds = random.randint(bedrooms, max_guests)
        bathrooms = random.choice([1, 2])
    elif prop_type == "villa":
        max_guests = random.choice([6, 8, 10])
        bedrooms = random.choice([3, 4, 5])
        beds = random.randint(bedrooms, max_guests)
        bathrooms = random.choice([2, 3])
    else:  # hotel
        max_guests = random.choice([2, 3, 4])
        bedrooms = 1
        beds = random.choice([1, 2])
        bathrooms = 1

    cleaning_fee = Decimal(str(round(price * random.uniform(0.10, 0.20), 2)))
    service_fee = Decimal(str(round(price * random.uniform(0.05, 0.12), 2)))

    return Listing(
        title=title,
        description=description,
        host_name=random.choice(HOST_NAMES),
        host_id=host_id,
        city=city,
        country=country,
        latitude=lat_off,
        longitude=lng_off,
        property_type=prop_type,
        price_per_night=Decimal(str(price)),
        cleaning_fee=cleaning_fee,
        service_fee=service_fee,
        max_guests=max_guests,
        bedrooms=bedrooms,
        beds=beds,
        bathrooms=bathrooms,
        rating=rating,
        review_count=review_count,
        amenities=amenities,
        images=images,
    )


def maybe_truncate(db, force: bool) -> None:
    """可选 TRUNCATE: 先清依赖表 (wishlist_items, bookings), 再 TRUNCATE listings"""
    if not force:
        return
    # 关闭 FK 检查快速清
    db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    db.execute(text("TRUNCATE TABLE wishlist_items"))
    db.execute(text("TRUNCATE TABLE bookings"))
    db.execute(text("TRUNCATE TABLE listings"))
    db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    db.commit()
    print("🗑  TRUNCATE: wishlist_items, bookings, listings")


# Block 15: 3 个 demo 房东账号, 分配 listings
DEMO_HOSTS = [
    ("host1@test.com", "host1", "Host Demo One"),
    ("host2@test.com", "host2", "Host Demo Two"),
    ("host3@test.com", "host3", "Host Demo Three"),
]
HOST_PASSWORD = "TestPass123!"


def ensure_demo_hosts(db) -> list[int]:
    """确保 3 个 demo 房东账号存在, 返回 user_id 列表 (3 个, 顺序固定)"""
    ids: list[int] = []
    for email, username, _ in DEMO_HOSTS:
        u = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if u is None:
            u = User(
                email=email,
                username=username,
                password_hash=hash_password(HOST_PASSWORD),
                is_host=True,
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        else:
            # 老 user 没 is_host 时也升一下
            if not u.is_host:
                u.is_host = True
                db.commit()
        ids.append(u.id)
    return ids


def existing_city_counts(db) -> dict[str, int]:
    """返回 {city: count} 用于增量 seed 跳过已有"""
    rows = db.execute(
        select(Listing.city, func.count())
        .group_by(Listing.city)
    ).all()
    return {city: count for city, count in rows}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--truncate", action="store_true", help="TRUNCATE 表后重建 (strict 1000)")
    args = parser.parse_args()

    random.seed(42)  # 确定性
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        maybe_truncate(db, args.truncate)

        # 增量模式: 跳过已有城市 (已有 >= 20 条视为该城市已 seed 完毕)
        existing = existing_city_counts(db)
        cities_to_seed: list[tuple] = []
        skipped_cities: list[str] = []
        for city_tuple in CITIES:
            city_name = city_tuple[0]
            have = existing.get(city_name, 0)
            if have >= 20:
                skipped_cities.append(city_name)
                continue
            cities_to_seed.append(city_tuple)

        if skipped_cities:
            print(f"⏭  跳过 {len(skipped_cities)} 个已 seed 城市 ({', '.join(skipped_cities[:5])}...)")
        if not cities_to_seed:
            print(f"✅ 50 城市均已 seed (现存 {sum(existing.values())} 条). 用 --truncate 重置")
            return

        new_listings: list[Listing] = []
        # Block 15: host_id 轮转分配
        host_ids = ensure_demo_hosts(db)
        # 每城市生成 20 条: 5 类型 × 4 个, host_id 轮转
        idx_counter = 0
        for city, country, lat, lng, neighborhoods in cities_to_seed:
            for prop_type in PROPERTY_TYPES:
                for _ in range(4):
                    host_id = host_ids[idx_counter % len(host_ids)]
                    idx_counter += 1
                    new_listings.append(
                        random_listing(city, country, lat, lng, neighborhoods, prop_type, host_id)
                    )

        # 批量插入, 每 200 一批
        BATCH = 200
        for i in range(0, len(new_listings), BATCH):
            db.add_all(new_listings[i:i + BATCH])
            db.commit()
            print(f"   insert batch {i // BATCH + 1}/{(len(new_listings) - 1) // BATCH + 1} ({len(new_listings[i:i + BATCH])} rows)")

        # 统计
        total = db.scalar(select(func.count()).select_from(Listing))
        cities = db.scalar(select(func.count(Listing.city.distinct())))
        print()
        print(f"✅ 完成. 总 {total} 条, {cities} 个城市")
        print(f"   本次新增 {len(new_listings)} 条 (城市: {len(cities_to_seed)})")
        if total != 1000:
            print(f"   ⚠️  当前总数 {total}, 严格 1000 需要: --truncate 重跑")


if __name__ == "__main__":
    main()
