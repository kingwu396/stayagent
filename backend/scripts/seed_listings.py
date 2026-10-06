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
GENERIC_NBRS = ["Downtown", "Old Town", "Riverside", "Hills", "Harbor"]

# 通用 city keywords (新城市兜底)
GENERIC_KEYWORDS = ["local cafe", "metro access", "old town charm", "historic district", "central location"]

CITIES = [
    # 现有 10 城 (保留)
    ("Tokyo", "Japan", 35.6762, 139.6503, ["Shibuya", "Shinjuku", "Asakusa", "Roppongi", "Ginza"]),
    ("Paris", "France", 48.8566, 2.3522, ["Marais", "Montmartre", "Saint-Germain", "Latin Quarter", "Le Marais"]),
    ("New York", "United States", 40.7128, -74.0060, ["SoHo", "Williamsburg", "Upper East Side", "Chelsea", "Harlem"]),
    ("London", "United Kingdom", 51.5074, -0.1278, ["Shoreditch", "Notting Hill", "Camden", "South Bank", "Brixton"]),
    ("Bangkok", "Thailand", 13.7563, 100.5018, ["Sukhumvit", "Silom", "Chinatown", "Ari", "Thonglor"]),
    ("Bali", "Indonesia", -8.4095, 115.1889, ["Ubud", "Seminyak", "Canggu", "Sanur", "Nusa Dua"]),
    ("Shanghai", "China", 31.2304, 121.4737, ["Xintiandi", "Jing'an", "French Concession", "Lujiazui", "Xuhui"]),
    ("Seoul", "South Korea", 37.5665, 126.9780, ["Gangnam", "Hongdae", "Itaewon", "Myeongdong", "Bukchon"]),
    ("Singapore", "Singapore", 1.3521, 103.8198, ["Tiong Bahru", "Chinatown", "Orchard", "Bugis", "Marina Bay"]),
    ("Rome", "Italy", 41.9028, 12.4964, ["Trastevere", "Monti", "Prati", "Testaccio", "Centro Storico"]),
    # 新增 40 城 (Block 14)
    # 日本
    ("Kyoto", "Japan", 35.0116, 135.7681, ["Gion", "Higashiyama", "Arashiyama", "Nakagyo"]),
    ("Osaka", "Japan", 34.6937, 135.5023, ["Namba", "Umeda", "Tennoji", "Shinsekai"]),
    # 中国/港台
    ("Beijing", "China", 39.9042, 116.4074, ["Sanlitun", "Wangfujing", "Houhai", "Guomao"]),
    ("Hong Kong", "Hong Kong", 22.3193, 114.1694, ["Central", "Tsim Sha Tsui", "Mong Kok", "Causeway Bay"]),
    ("Taipei", "Taiwan", 25.0330, 121.5654, ["Ximen", "Daan", "Shida", "Songshan"]),
    ("Chengdu", "China", 30.5728, 104.0668, ["Jinli", "Chunxi Road", "Kuanzhai Alley"]),
    # 东南亚
    ("Phuket", "Thailand", 7.8804, 98.3923, ["Patong", "Kata", "Karon", "Rawai"]),
    ("Chiang Mai", "Thailand", 18.7883, 98.9853, ["Old City", "Nimmanhaemin", "Chang Phueak"]),
    ("Hanoi", "Vietnam", 21.0285, 105.8542, ["Old Quarter", "Hoan Kiem", "French Quarter"]),
    ("Ho Chi Minh", "Vietnam", 10.8231, 106.6297, ["District 1", "Bui Vien", "Saigon South"]),
    ("Kuala Lumpur", "Malaysia", 3.1390, 101.6869, ["Bukit Bintang", "KLCC", "Chinatown"]),
    ("Manila", "Philippines", 14.5995, 120.9842, ["Makati", "BGC", "Intramuros"]),
    ("Jakarta", "Indonesia", -6.2088, 106.8456, ["Sudirman", "Kemang", "Old Town"]),
    # 中东/南亚
    ("Dubai", "UAE", 25.2048, 55.2708, ["Downtown Dubai", "Marina", "Palm Jumeirah", "Old Dubai"]),
    ("Istanbul", "Turkey", 41.0082, 28.9784, ["Sultanahmet", "Beyoglu", "Kadikoy", "Besiktas"]),
    ("Mumbai", "India", 19.0760, 72.8777, ["Colaba", "Bandra", "Juhu", "Powai"]),
    ("Delhi", "India", 28.6139, 77.2090, ["Connaught Place", "Hauz Khas", "Karol Bagh"]),
    # 欧洲
    ("Barcelona", "Spain", 41.3851, 2.1734, ["Eixample", "Gracia", "Barceloneta", "Gothic Quarter"]),
    ("Madrid", "Spain", 40.4168, -3.7038, ["Sol", "Malasana", "Chueca", "Salamanca"]),
    ("Amsterdam", "Netherlands", 52.3676, 4.9041, ["Jordaan", "De Pijp", "Centrum", "Oud-West"]),
    ("Berlin", "Germany", 52.5200, 13.4050, ["Mitte", "Kreuzberg", "Prenzlauer Berg", "Neukoelln"]),
    ("Munich", "Germany", 48.1351, 11.5820, ["Altstadt", "Schwabing", "Glockenbachviertel"]),
    ("Vienna", "Austria", 48.2082, 16.3738, ["Innere Stadt", "Leopoldstadt", "Neubau"]),
    ("Prague", "Czech Republic", 50.0755, 14.4378, ["Old Town", "Lesser Town", "Vinohrady"]),
    ("Lisbon", "Portugal", 38.7223, -9.1393, ["Alfama", "Bairro Alto", "Belem", "Príncipe Real"]),
    ("Athens", "Greece", 37.9838, 23.7275, ["Plaka", "Monastiraki", "Koukaki", "Psyrri"]),
    ("Florence", "Italy", 43.7696, 11.2558, ["Duomo", "Oltrarno", "Santa Croce"]),
    ("Venice", "Italy", 45.4408, 12.3155, ["San Marco", "Cannaregio", "Dorsoduro"]),
    ("Milan", "Italy", 45.4642, 9.1900, ["Brera", "Navigli", "Porta Nuova"]),
    ("Zurich", "Switzerland", 47.3769, 8.5417, ["Altstadt", "Niederdorf", "Seefeld"]),
    ("Geneva", "Switzerland", 46.2044, 6.1432, ["Old Town", "Paquis", "Eaux-Vives"]),
    ("Edinburgh", "United Kingdom", 55.9533, -3.1883, ["Old Town", "New Town", "Leith"]),
    # 大洋洲
    ("Sydney", "Australia", -33.8688, 151.2093, ["CBD", "Surry Hills", "Bondi", "Newtown"]),
    ("Melbourne", "Australia", -37.8136, 144.9631, ["CBD", "Fitzroy", "St Kilda", "Brunswick"]),
    ("Auckland", "New Zealand", -36.8485, 174.7633, ["CBD", "Ponsonby", "Wynyard Quarter"]),
    # 美洲
    ("Vancouver", "Canada", 49.2827, -123.1207, ["Downtown", "Gastown", "Yaletown", "Kitsilano"]),
    ("Toronto", "Canada", 43.6532, -79.3832, ["Downtown", "Queen West", "Distillery District", "Yorkville"]),
    ("Mexico City", "Mexico", 19.4326, -99.1332, ["Centro", "Roma", "Condesa", "Coyoacan"]),
    ("Buenos Aires", "Argentina", -34.6037, -58.3816, ["Palermo", "San Telmo", "Recoleta", "Belgrano"]),
    ("Rio de Janeiro", "Brazil", -22.9068, -43.1729, ["Copacabana", "Ipanema", "Leblon", "Santa Teresa"]),
]

PROPERTY_TYPES = ["apartment", "house", "villa", "studio", "hotel"]

PRICE_RANGES = {
    "studio": (40, 120),
    "apartment": (60, 200),
    "house": (120, 400),
    "villa": (300, 800),
    "hotel": (100, 300),
}

HOST_NAMES = [
    "Akira", "Yuki", "Hiroshi", "Sakura",
    "Pierre", "Marie", "Jean", "Sophie",
    "Mike", "Sarah", "David", "Emma",
    "Wei", "Lin", "Chen", "Ming",
    "Min", "Ji", "Soo", "Hye",
    "Luca", "Giulia", "Marco", "Elena",
    "Anong", "Krit", "Made", "Putri",
    # Block 14 扩 名字池
    "Sven", "Ingrid", "Lars", "Astrid",
    "Carlos", "Sofia", "Diego", "Lucia",
    "Andrei", "Olga", "Dmitri", "Natasha",
    "Chen", "Liu", "Wang", "Zhang",
    "Hassan", "Fatima", "Omar", "Layla",
    "Raj", "Priya", "Arjun", "Anika",
]

TITLE_TEMPLATES = {
    "apartment": [
        "Modern {type} in {neighborhood}",
        "Cozy {type} near {neighborhood}",
        "{type} with city view in {neighborhood}",
    ],
    "house": [
        "Charming {type} in {neighborhood}",
        "Family {type} in {neighborhood}",
        "Spacious {type} with garden - {neighborhood}",
    ],
    "villa": [
        "Luxury {type} in {neighborhood}",
        "Private {type} with pool - {neighborhood}",
        "Stunning {type} overlooking {neighborhood}",
    ],
    "studio": [
        "Compact {type} in {neighborhood}",
        "Stylish {type} near {neighborhood}",
        "Bright {type} in the heart of {neighborhood}",
    ],
    "hotel": [
        "Boutique {type} in {neighborhood}",
        "Modern {type} near {neighborhood}",
        "Heritage {type} - {neighborhood}",
    ],
}

DESC_SENTENCES = [
    "Welcome to our lovely place, perfect for travelers looking to explore {city}.",
    "Located in the heart of {neighborhood}, you'll be steps away from cafes, restaurants, and public transit.",
    "The space features comfortable beds, a fully equipped kitchen, and high-speed WiFi.",
    "Enjoy stunning views and authentic local vibes in this carefully curated {type}.",
    "Walking distance to major attractions and easy access to metro stations.",
    "Ideal for couples, families, or solo travelers seeking comfort and convenience.",
    "Recently renovated with modern amenities while preserving local character.",
    "Our favorite spot is the cozy corner with natural light - perfect for morning coffee.",
]

CITY_KEYWORDS = {
    "Tokyo": ["near metro", "shibuya crossing", "traditional tatami"],
    "Paris": ["walk to Eiffel Tower", "café culture", "Seine river view"],
    "New York": ["central park", "subway access", "brooklyn vibe"],
    "London": ["tube station", "pub culture", "hyde park"],
    "Bangkok": ["BTS skytrain", "street food", "temple nearby"],
    "Bali": ["rice paddy view", "beach club", "yoga studio"],
    "Shanghai": ["bund view", "French concession", "metro line 2"],
    "Seoul": ["Hongdae nightlife", "Gangnam style", "han river"],
    "Singapore": ["hawker center", "marina bay", "MRT station"],
    "Rome": ["colosseum walking", "trattoria", "vintage charm"],
    # Block 14 补充
    "Kyoto": ["temple walk", "geisha district", "matcha cafe"],
    "Osaka": ["takoyaki street", "dotonbori", "okonomiyaki"],
    "Beijing": ["hutong walk", "forbidden city", "peking duck"],
    "Hong Kong": ["star ferry", "dim sum", "night market"],
    "Taipei": ["night market", "bubble tea", "hot spring nearby"],
    "Dubai": ["burj khalifa view", "desert safari", "luxury shopping"],
    "Istanbul": ["bosphorus cruise", "grand bazaar", "hammam"],
    "Barcelona": ["sagrada familia", "tapas bar", "beach gatiga"],
    "Amsterdam": ["canal cruise", "bike tour", "van gogh museum"],
    "Berlin": ["wall memorial", "tech hub", "bratwurst"],
    "Vienna": ["coffee house", "classical concert", "sachertorte"],
    "Prague": ["old town square", "beer hall", "astronomical clock"],
    "Sydney": ["opera house view", "bondi beach", "harbour bridge"],
    "Tokyo": ["near metro", "shibuya crossing", "traditional tatami"],  # duplicate, kept for compat
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
    title = title_tpl.format(type=prop_type.title(), neighborhood=neighborhood)

    desc_parts = random.sample(DESC_SENTENCES, 3)
    keywords = CITY_KEYWORDS.get(city, GENERIC_KEYWORDS)
    if keywords and random.random() > 0.4:
        desc_parts.append(f"Local highlight: {random.choice(keywords)}.")
    description = " ".join(p.format(city=city, neighborhood=neighborhood, type=prop_type) for p in desc_parts)

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
