"""Seed travel_tips: 30 条 RAG 知识库 (Block 12)

策略:
- 5 大类 (visa/transport/food/safety/culture), 每类 6 条 = 30 条
- 每条 {title, content, category, destination}
- 全部通过 sentence-transformers 预计算 embedding, 存 JSON
- 幂等: 按 title 查重, 已存在则跳过 (避免重复 embed)
- HF_ENDPOINT=https://hf-mirror.com 已配置, 国内下载快

运行: uv run python -m scripts.seed_travel_tips
"""
import logging
import sys
import time
from sqlalchemy import select, delete

from app.db.session import SessionLocal, engine
from app.models import TravelTip
from app.services.rag.embedding import embed_text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ============ 30 条种子数据 ============

TIPS = [
    # === visa (6) ===
    {
        "title": "日本签证基础申请流程",
        "content": "中国公民赴日旅游需办理日本旅游签证, 通常通过指定旅行社代为申请. "
                  "基本材料: 护照原件 + 照片 + 在职证明 + 银行流水 (近6个月) + 签证申请表. "
                  "单次签证有效期 3 个月, 最长停留 15 天. 建议出发前 1 个月办理.",
        "category": "visa",
        "destination": "Japan",
    },
    {
        "title": "申根签证通用要点",
        "content": "申根签证覆盖 29 个欧洲国家. 申请前需确定主入境国, 向该国领事馆/签证中心递交. "
                  "材料: 护照 + 照片 + 行程单 + 机票预订单 + 酒店预订单 + 旅行保险 (≥3万欧) + 在职/在学证明 + 银行流水. "
                  "首次申请建议提前 2-3 个月, 旺季可能更久.",
        "category": "visa",
        "destination": "Europe",
    },
    {
        "title": "美国 B1/B2 签证面试常见问题",
        "content": "美国 B1/B2 旅游签证需要面签, 常见问题: 旅行目的、行程安排、是否有亲属在美、工作情况、是否会按时回国. "
                  "建议准备: 英文行程单 + 往返机票 + 酒店预订 + 在职证明 + 资产证明. 面签时从容、简洁回答即可.",
        "category": "visa",
        "destination": "USA",
    },
    {
        "title": "泰国免签与落地签区别",
        "content": "中国公民赴泰可享受免签政策, 单次停留不超过 30 天, 无需提前办理签证. "
                  "若需停留更久, 可在机场办理落地签 (TR-15), 费用约 2000 泰铢, 需准备返程机票 + 酒店订单 + 现金. "
                  "护照有效期需 > 6 个月.",
        "category": "visa",
        "destination": "Thailand",
    },
    {
        "title": "韩国电子签证 K-ETA 申请",
        "content": "中国公民赴韩旅游可申请 K-ETA (韩国电子旅行许可), 费用 1 万韩元. "
                  "通过官网填写资料 + 上传照片, 一般 24 小时内审批. K-ETA 有效期 2 年, 单次停留 ≤ 90 天. "
                  "材料: 护照 + 照片 + 行程信息.",
        "category": "visa",
        "destination": "Korea",
    },
    {
        "title": "澳大利亚签证 eVisitor (651)",
        "content": "中国公民可申请澳大利亚 600 类访客签证 (旅游/探亲/商务). 需在线 ImmiAccount 提交. "
                  "基本材料: 护照 + 身份证 + 资产 (近 3-6 个月流水) + 在职证明 + 行程单. "
                  "审理周期约 15-30 个工作日, 费用约 AUD 145. 建议提前 1 个月办理.",
        "category": "visa",
        "destination": "Australia",
    },

    # === transport (6) ===
    {
        "title": "日本交通卡 Suica/Pasmo",
        "content": "Suica (JR 东日本) / Pasmo (私营铁道) 储值卡覆盖东京及周边 JR、地铁、巴士、自动售货机. "
                  "可在车站自动售票机购买 (含押金 500 日元), 也支持 Apple/Google Pay 虚拟卡. "
                  "便利店购物、部分自动售货机也接受. 离开时余额可退 (扣手续费).",
        "category": "transport",
        "destination": "Tokyo",
    },
    {
        "title": "巴黎地铁与 Navigo Easy 卡",
        "content": "巴黎地铁 14 条线覆盖市区和近郊, 运营 5:30-1:15. Navigo Easy 卡可在地铁站机器购买, "
                  "随用随充, 比单程票便宜. 巴黎观光通票 Paris Visite 可在 1/2/3/5 日内不限连随到机场、迪士尼. "
                  "打车推荐 Bolt 或 Uber, 出租车较贵.",
        "category": "transport",
        "destination": "Paris",
    },
    {
        "title": "伦敦 Oyster Card 与 Contactless",
        "content": "Oyster Card 是伦敦公共交通储值卡, 覆盖地铁 (Tube)、巴士、轻轨 (DLR)、Overground. "
                  "可在地铁站机器或便利店买. Zone 1-2 区单程 £2.80, 日上限 £8.50. "
                  "现在直接刷 contactless 卡 (Visa/Mastercard/Apple/Google Pay) 也行, 系统自动按当日最优计费.",
        "category": "transport",
        "destination": "London",
    },
    {
        "title": "纽约地铁与 MTA 票务",
        "content": "纽约地铁 24 小时运营, 472 个车站, 单一票价 $2.90 (不论远近). "
                  "可刷 OMNY (contactless, 同一卡 7 天内 12 次后免费后续, 后续需激活) 或 MetroCard (即将退市). "
                  "曼哈顿以外区域需 Suburban Bus. 出租车黄色 (Yellow Cab) 起价 $3, Uber/Lyft 也普及.",
        "category": "transport",
        "destination": "New York",
    },
    {
        "title": "巴塞罗那 T-Casual 10 次卡",
        "content": "T-Casual 是巴塞罗那地铁/巴士/有轨电车的 10 次连随卡, 售价 €11.35. "
                  "比单程票 (€2.40) 划算. T-Casual 在地铁站机器或 tabac 便利店买. "
                  "1 区 (Zone 1) 覆盖机场 T1/T2 (但 T1 连 T2 需另外买). 出租车很多但停收费.",
        "category": "transport",
        "destination": "Barcelona",
    },
    {
        "title": "首尔 T-money 卡",
        "content": "T-money 是韩国通用交通储值卡, 覆盖首尔地铁、巴士、出租车、便利店. "
                  "可在地铁站机器或 CU/GS25 便利店购买 (含押金 2500 韩元, 可退). "
                  "首尔地铁基本票价 1400 韩元 (T-money 折扣后 1250 韩元). "
                  "充值最低 1000 韩元, 最高 100 万韩元.",
        "category": "transport",
        "destination": "Seoul",
    },

    # === food (6) ===
    {
        "title": "东京便宜又好吃的连锁寿司",
        "content": "东京高人气连锁寿司: はま鮨寿司 (¥100-¥150 一盘), くら鮨鮨 (¥110 一盘), スシロー (¥115 一盘). "
                  "性价比高, 适合连随吃. 高级寿司推荐 鮨さいとう (米其林三星, 需预约) 或 鮨あと鮨鮨 (¥3-5万/位). "
                  "市场新鲜鮨: 筑地场外市场 鮨国、鮨米店. 多数小店 18:00 后打折券 (回転ずしアプリ).",
        "category": "food",
        "destination": "Tokyo",
    },
    {
        "title": "巴黎必吃法式甜点店",
        "content": "巴黎顶级甜点店: Ladurée (马卡龙发源, Rue Bonaparte), Pierre Hermé (马卡龙, 多口味世界顶级), "
                  "Sébastien Gaudard (传统法式甜点), Carette (马卡龙 + 可颂), Du Pain et des Idées (招牌面包). "
                  "价格: 马卡龙 €2-3/个, 套餐装更划算. 多数店面 11:00-19:00. 周末热门店需排队 30 分钟+.",
        "category": "food",
        "destination": "Paris",
    },
    {
        "title": "首尔必吃韩式烤肉店",
        "content": "首尔必吃烤肉: 八色五花肉 (8 种不同腌制五花肉, 需预约), 韩一馆 (高档牛肉), "
                  "荒艳山庄 (足总店, 排队人气店), 梅花肉专门店 (猪肉连锁). "
                  "推荐部位: 排骨肉 (갈비살) + 牛脖子肉 (차돌박이). "
                  "人均消费: 连锁店 ¥80-150, 高档 ¥300-500. 多数店 17:00-凌晨 2:00 营业.",
        "category": "food",
        "destination": "Seoul",
    },
    {
        "title": "曼谷街头美食推荐",
        "content": "曼谷街头美食: 船面 (Baan Kuay Tiew Reua, 30 泰铢/碗), "
                  "海南鸡饭 (Go-Ang Chicken Rice, 50 泰铢), 芒果糯米饭 (Mae Varee, 60 泰铢), "
                  "烤肉串 (Ratchada Rot Fai Night Market, 10-30 泰铢/串), "
                  "烧鱿鱼 (Trok Pho, 50 泰铢), 泰式奶茶 (Cha Tra Mue, 250ml 30 泰铢). "
                  "推荐夜市: Ratchada Rot Fai, Chatuchak, Asiatique.",
        "category": "food",
        "destination": "Bangkok",
    },
    {
        "title": "台湾必吃小吃店",
        "content": "台湾必吃: 蚵仔煎 (宁夏圆中D / 赖桑蚵仔煎, ¥40/份), 卤肉饭 (金峰鲁肉饭, ¥40/份), "
                  "牛肉面 (永康牛肉面, ¥200/份), 大肠包小肠 (士林夜市, ¥50/份), "
                  "杯杯冷 (春中冷杯杯冷, ¥35/份), 棺材板 (夜市名店). "
                  "推荐夜市: 士林, 逢甲, 饶河, 宁夏. 人均 ¥100-200 可吃撑.",
        "category": "food",
        "destination": "Taipei",
    },
    {
        "title": "香港茶餐厅推荐",
        "content": "香港茶餐厅推荐: 翠华餐厅 (连锁, 菠萝油 + 丝袜奶茶), "
                  "添好运 (米其林, 虾饺 + 蛋挞), 美都餐室 (老式冰室), 祥兴记 (生煎 + 醉鸡), "
                  "陆羽茶室 (高档广式). 价格: 茶餐 ¥40-80, 套餐 ¥100-300. "
                  "多数茶餐厅 06:00-22:00 营业, 周末热门店需排队.",
        "category": "food",
        "destination": "Hong Kong",
    },

    # === safety (6) ===
    {
        "title": "东京安全旅行须知",
        "content": "东京是世界最安全城市之一. 注意事项: ①地铁末班车 24:00 左右, 错过请打出租车. ②在人多场所 (涩谷/新宿/浅草) 看护好财物. "
                  "③紧急电话 110 (警察) / 119 (救护). ④中文紧急窗口: 东京观光案所内 (03-5321-3070). "
                  "⑤地震 ≥5 级时在车站/酒店门口的脱鞋处集合. ⑥台风季 (7-9 月) 看护台风警报.",
        "category": "safety",
        "destination": "Tokyo",
    },
    {
        "title": "巴黎防盗必备指南",
        "content": "巴黎小偷多, 重点防区: 北站、地铁 1 号线、里贾路、埃菲尔铁塔、卢浮宫、凡尔赛. "
                  "反扒要点: ①护照 + 信用卡备份分两处放 ②贴身腰包 + 背包前锁反 ④不进 15 以下不现护照. "
                  "遇扒: 不抵抗, 记特征, 携 48 小时内去中国领事馆 (15 Rue Washington) 补办护照. "
                  "紧急 17 (警察) / 15 (救护).",
        "category": "safety",
        "destination": "Paris",
    },
    {
        "title": "曼谷旅行安全提示",
        "content": "曼谷总体安全, 但注意: ①出租车选打表 (By Meter) 或用 Bolt/Grab ②不进 15 以下连随支付小费 (50-100 泰铢) ③BTS/MRT 看护手机 ④. "
                  "禁区: 凌晨 2 点后某些街区 (帕型后路 / 考山路部分) 警亮多. "
                  "医疗: 曼谷医院 (Bumrungrad) / 康民医院 (Bangkok Hospital), 紧急 191 (警察) / 1669 (救护).",
        "category": "safety",
        "destination": "Bangkok",
    },
    {
        "title": "纽约旅游安全注意事项",
        "content": "纽约总体安全, 但注意: ① 1-2 号线深夜 1-4 点不爱坐 ②夜间不进 15 以下独行曼哈顿 137 街以上 ③地铁里不进 15 以下独行末班车 ④. "
                  "Bolt/Uber 安全. 医疗: 纽约医院 (Mount Sinai / NYU Langone). "
                  "紧急 911. 中国领事馆: 12 W 66th St (646-369-9930).",
        "category": "safety",
        "destination": "New York",
    },
    {
        "title": "意大利旅行防偷指南",
        "content": "意大利小偷泛滥, 重点为: 米兰中央车站、罗马 Termini、佛罗伦萨 SMN、威尼斯 Rialto. "
                  "反扒: ①背包前锁反 ②贴身腰包放护照 ③不进 15 以下连随表演包 ④现钱分两处放. "
                  "遇扒: 不抵抗, 携 48 小时内去警察局报案 (denuncia) + 中国领事馆 (罗马: Via San Camillo De Lellis). "
                  "紧急 112 (警察 / 救护).",
        "category": "safety",
        "destination": "Italy",
    },
    {
        "title": "巴厘岛水浸安全须知",
        "content": "巴厘岛热门: 海滩、寺庙、火山. 安全注意: ①勿独自下水 (尤其库塔 / 努沙杜瓦), 看红地毯浮起. "
                  "②骑摩托需驾照 + 护身 (多人遇难). ③火山远足 (Batur / Agung) 带导游. ④吴辣隆 (峇厘岛国庙) 进需着围裙. "
                  "医疗: BIMC Hospital (Kuta / Nusa Dua). 紧急 110 (警察) / 118 (救护). "
                  "中国领事馆: 巴厘岛领事馆 (0361-2398646).",
        "category": "safety",
        "destination": "Bali",
    },

    # === culture (6) ===
    {
        "title": "日本神社寺庙礼节",
        "content": "① 进神社前在手水舍洗手 + 漱口 (左手洗手 → 换右手 → 左掌接水漱口). ②拜礼: 投香油钱 → 摇铃 → 鞠躬两次 → 拍手两次 → 合掌默祷 → 鞠躬一次. "
                  "③脱鞋进殿内. ④不进 15 以下进主殿拍照. ⑥不进 15 以下手插口袋跨鸟居内. "
                  "热门: 明治神宫 (东京) / 伏见稻荷 (京都) / 出云大社 (岛根) / 严岛神社 (广岛).",
        "category": "culture",
        "destination": "Japan",
    },
    {
        "title": "泰国寺庙礼仪与着装",
        "content": "泰国寺庙 (Wat) 着装: ①肩 + 膝覆盖, 不能裸肩/超短裙 ②入口处有免费纱笼可借. "
                  "礼仪: ①脱鞋进殿 ②盘腿坐, 不指脚朝向佛像 ③不进 15 以下摸和尚 (女限). "
                  "热门: 玉佛寺 (Wat Phra Kaew, 曼谷)、卧佛寺 (Wat Pho)、黎明寺 (Wat Arun)、白庙 (Wat Rong Khun, 清莱).",
        "category": "culture",
        "destination": "Thailand",
    },
    {
        "title": "印度教寺庙禁忌",
        "content": "①着装严: 肩 + 膝全覆盖 ②脱鞋, 有时脱袜 ③不进 15 以下拍照 (有额外收费) ④不进 15 以下触碰神像 / 围栏. "
                  "⑤左手为不洁手, 递物供餐如交右手. "
                  "热门: 湿婆神庙 (克久拉霍 / 埃洛拉)、泰姬陵 (阿格拉)、阿姆利则金庙 (旁遮普) / 斯里兰卡佛牙寺 (康提).",
        "category": "culture",
        "destination": "India",
    },
    {
        "title": "巴黎博物馆参观礼仪",
        "content": "①卢浮宫: 周二闭馆, 周三/五 18 点后免费 (需提前 4 周预约) ②奥赛博物馆: 周一闭馆 ③蓬皮杜: 周二闭馆, 周四 21 点后免费. "
                  "④访馆不接触文物, 不使用闪光灯 ⑤不整队时人工席接別人 ⑥提前预约跳过队. "
                  "通票: Paris Museum Pass 2/4/6 日, €70/€95/€125, 多个博物馆免费.",
        "category": "culture",
        "destination": "Paris",
    },
    {
        "title": "印度斋食与小费习惯",
        "content": "印度餐厅分: Veg (素) / Non-Veg (荤) / Jain (不吃洋葱/大蒜). 多数连锁酒店与机场供应素食. "
                  "街头小吃选择热摊位, 避免生菜 + 冷盘 (肠虫风险). "
                  "小费: 餐厅 5-10%, 酒店服务生 ₹5-20/次, 司机 ₹20-50, 导游 ¥2-500/天. "
                  "不含在账单, 主动付现. 路口乞讨: 不现金, 多询间当地路资.",
        "category": "culture",
        "destination": "India",
    },
    {
        "title": "清真寺礼仪与着装",
        "content": "①男士: 长裤 + 不裸肩 ②女士: 长袖 + 长裙/裤 + 头巾 (门口免费借). ③脱鞋, 不进 15 以下踩殿内地毯. "
                  "④周五主麻日不进 15 以下参观 (闭馆). ⑤不进 15 以下拍照. "
                  "热门: 蓝色清真寺 (伊斯坦布尔) / 谢赫扎耶德大清真寺 (阿布扎比) / 阿尔阿兹哈尔 (开罗) / 阿克萨清真寺 (耶路撒冷).",
        "category": "culture",
        "destination": None,  # 通用
    },
]


# ============ Main ============

def main() -> int:
    print("=" * 60)
    print(f"🌱 Seeding {len(TIPS)} travel_tips (Block 12 RAG)")
    print("=" * 60)

    with SessionLocal() as db:
        # 1. 统计已存在的 title
        existing_titles = set(
            db.execute(select(TravelTip.title)).scalars().all()
        )

        inserted = 0
        skipped = 0
        failed = 0
        for tip in TIPS:
            if tip["title"] in existing_titles:
                skipped += 1
                continue
            try:
                t0 = time.monotonic()
                vec = embed_text(f"{tip['title']}. {tip['content']}")
                dt = time.monotonic() - t0
                print(f"  embed '{tip['title'][:30]}...' ({len(vec)}d, {dt:.2f}s)")
            except Exception as e:
                print(f"  ⚠️ embed failed for '{tip['title']}': {e}")
                failed += 1
                continue

            db.add(TravelTip(
                title=tip["title"],
                content=tip["content"],
                category=tip["category"],
                destination=tip["destination"],
                embedding=vec,
            ))
            inserted += 1

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"\n❌ commit failed: {e}")
            return 1

        # 2. 总数
        total = db.execute(select(TravelTip)).scalars().all()
        print()
        print("=" * 60)
        print(f"✅ Seed complete: inserted={inserted} skipped={skipped} failed={failed}")
        print(f"   travel_tips 表现有 {len(total)} 条")
        print("=" * 60)

    engine.dispose()
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
