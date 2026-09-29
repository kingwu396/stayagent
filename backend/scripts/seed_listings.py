"""
Seed 100 listings across 10 global cities.

幂等：已有数据则跳过。强制重置：先 python -c "from app.models import Listing; ..." 删表，
或直接 DROP TABLE listings。

图片用 picsum.photos 的 seed 模式，确定性 + 无需下载。
"""
import random
from decimal import Decimal

from sqlalchemy import select, func
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models import Listing

import app.models  # noqa: F401  确保所有模型注册


# ============ 数据池 ============

CITIES = [
    # (city, country, lat, lng, neighborhoods, type_distribution)
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
]

PROPERTY_TYPES = ["apartment", "house", "villa", "studio", "hotel"]

# 价格区间（每晚，美元）
PRICE_RANGES = {
    "studio": (40, 120),
    "apartment": (60, 200),
    "house": (120, 400),
    "villa": (300, 800),
    "hotel": (100, 300),
}

# 房东名字池（中英文混合）
HOST_NAMES = [
    "Akira", "Yuki", "Hiroshi", "Sakura",
    "Pierre", "Marie", "Jean", "Sophie",
    "Mike", "Sarah", "David", "Emma",
    "Wei", "Lin", "Chen", "Ming",
    "Min", "Ji", "Soo", "Hye",
    "Luca", "Giulia", "Marco", "Elena",
    "Anong", "Krit", "Made", "Putri",
]

# 标题模板
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

# 描述模板（3 句拼接）
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

# 城市特定关键词
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
}

# 设施池
AMENITY_POOL = [
    "wifi", "kitchen", "washer", "dryer", "air conditioning",
    "heating", "workspace", "pool", "gym", "parking",
    "tv", "coffee maker", "balcony", "garden",
]

# 按类型筛 amenities
AMENITIES_BY_TYPE = {
    "apartment": ["wifi", "kitchen", "washer", "air conditioning", "workspace", "tv", "coffee maker"],
    "house": ["wifi", "kitchen", "washer", "dryer", "parking", "garden", "tv", "heating"],
    "villa": ["wifi", "kitchen", "washer", "dryer", "pool", "parking", "garden", "balcony", "tv"],
    "studio": ["wifi", "kitchen", "air conditioning", "workspace", "coffee maker", "tv"],
    "hotel": ["wifi", "air conditioning", "tv", "gym", "workspace", "coffee maker", "heating"],
}


def random_listing(city: str, country: str, lat: float, lng: float,
                   neighborhoods: list[str], prop_type: str) -> Listing:
    """生成一条随机房源"""
    neighborhood = random.choice(neighborhoods)
    price_min, price_max = PRICE_RANGES[prop_type]
    price = round(random.uniform(price_min, price_max), 2)

    title_tpl = random.choice(TITLE_TEMPLATES[prop_type])
    title = title_tpl.format(type=prop_type.title(), neighborhood=neighborhood)

    # 描述：3 句拼接
    desc_parts = random.sample(DESC_SENTENCES, 3)
    keywords = CITY_KEYWORDS.get(city, [])
    if keywords and random.random() > 0.4:
        desc_parts.append(f"Local highlight: {random.choice(keywords)}.")
    description = " ".join(p.format(city=city, neighborhood=neighborhood, type=prop_type) for p in desc_parts)

    # 坐标：城市中心 + ±0.05 偏移
    lat_off = Decimal(str(round(lat + random.uniform(-0.05, 0.05), 6)))
    lng_off = Decimal(str(round(lng + random.uniform(-0.05, 0.05), 6)))

    # amenities: 从类型池里取 3-6 个
    pool = AMENITIES_BY_TYPE[prop_type]
    amenities = random.sample(pool, random.randint(3, min(6, len(pool))))

    # images: 3-5 张 picsum（用 slug 保证确定性）
    slug = f"{city.lower()}-{neighborhood.lower().replace(' ', '')}-{prop_type}"
    n_images = random.randint(3, 5)
    images = [
        f"https://picsum.photos/seed/{slug}-{i}/800/600"
        for i in range(n_images)
    ]

    # 评分 4.0-5.0（保留 1 位小数）
    rating = Decimal(str(round(random.uniform(4.0, 5.0), 1)))
    # 评论数：评分越高一般越多
    review_count = random.randint(10, 500)

    # 房型参数
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

    # 清理费 + 服务费
    cleaning_fee = Decimal(str(round(price * random.uniform(0.10, 0.20), 2)))
    service_fee = Decimal(str(round(price * random.uniform(0.05, 0.12), 2)))

    return Listing(
        title=title,
        description=description,
        host_name=random.choice(HOST_NAMES),
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


def main():
    random.seed(42)  # 确定性：每次跑数据一样

    # 确保表存在
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        existing = db.scalar(select(func.count()).select_from(Listing))
        if existing and existing > 0:
            print(f"⏭  listings 表已有 {existing} 条数据，跳过 seed")
            print(f"   重置方式：mysql -e 'TRUNCATE TABLE listings;'")
            return

        listings: list[Listing] = []
        for city, country, lat, lng, neighborhoods in CITIES:
            # 每个城市生成 10 条，5 种类型各 2 条
            for prop_type in PROPERTY_TYPES:
                for _ in range(2):
                    listings.append(
                        random_listing(city, country, lat, lng, neighborhoods, prop_type)
                    )

        db.add_all(listings)
        db.commit()

        # 统计
        city_counts: dict[str, int] = {}
        type_counts: dict[str, int] = {}
        for l in listings:
            city_counts[l.city] = city_counts.get(l.city, 0) + 1
            type_counts[l.property_type] = type_counts.get(l.property_type, 0) + 1

        print(f"✅ Seeded {len(listings)} listings across {len(CITIES)} cities")
        print()
        print("📍 每城市条数:")
        for city, count in city_counts.items():
            print(f"   {city:15s} {count:3d}")
        print()
        print("🏠 每类型条数:")
        for pt, count in type_counts.items():
            print(f"   {pt:15s} {count:3d}")


if __name__ == "__main__":
    main()
