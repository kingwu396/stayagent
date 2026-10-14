"""Agent Tool 的 OpenAI Function Calling JSON Schema 定义

依据: docs/project-charter.md §6.1 + §6.3
共 14 个 tool (含 RAG 的 search_travel_tips):
    1.  search_listings        8.  create_booking
    2.  get_listing_detail     9.  list_my_trips
    3.  compare_listings       10. parse_travel_plan_pdf
    4.  add_to_wishlist        11. recommend_from_plan
    5.  remove_from_wishlist   12. search_travel_tips (RAG)
    6.  list_wishlists         13. check_availability (Block 33)
    7.  create_wishlist        14. get_listing_calendar (Block 33)

Block 9 orchestrator 直接 `client.chat(messages, tools=ALL_TOOL_SCHEMAS)` 调用.
Tool 实际实现分散在后续 Block 9-13, 此处只定义 schema.

约定:
- name 严格 snake_case (OpenAI Function Calling 强制)
- description 中文, 说明**何时调用** (LLM 决策依据)
- parameters 完整 JSON Schema: properties / required / enum / description
"""

# ---------- 1. search_listings ----------
search_listings = {
    "type": "function",
    "function": {
        "name": "search_listings",
        "description": (
            "根据城市、类型、价格、人数等条件搜索房源, 返回最匹配的若干条。"
            "当用户提到目的地、住宿类型、预算时, 或需要先找候选再推荐时, 必须使用此工具。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市中文名, 必须使用系统提示里列出的可用城市(如 \"东京\"、\"巴黎\"), 不要用英文名"},
                "property_type": {
                    "type": "string",
                    "enum": ["studio", "apartment", "house", "villa", "hotel"],
                    "description": "房源类型英文键: villa/apartment/house/hotel/studio (中文如别墅/公寓也可识别)",
                },
                "min_price": {"type": "number", "description": "每晚最低价格 (¥)"},
                "max_price": {"type": "number", "description": "每晚最高价格 (¥)"},
                "min_guests": {"type": "integer", "minimum": 1, "description": "最少入住人数"},
                "q": {"type": "string", "description": "标题模糊搜索关键词, 如 'shibuya'"},
                "limit": {
                    "type": "integer",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 20,
                    "description": "返回条数, 默认 5",
                },
            },
            "required": [],
        },
    },
}

# ---------- 2. get_listing_detail ----------
get_listing_detail = {
    "type": "function",
    "function": {
        "name": "get_listing_detail",
        "description": (
            "获取某个房源的完整详情: 描述、评分、房型、设施、坐标、价格拆解。"
            "当需要查看某个具体房源, 或在比较/推荐前先深入了解时, 使用此工具。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "listing_id": {"type": "integer", "description": "房源 ID"},
            },
            "required": ["listing_id"],
        },
    },
}

# ---------- 3. compare_listings ----------
compare_listings = {
    "type": "function",
    "function": {
        "name": "compare_listings",
        "description": (
            "对比多个房源的关键属性 (价格/评分/位置/设施/床型)。"
            "当用户想比较 2-3 个候选, 或在推荐阶段需要并列展示时, 必须使用此工具。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "listing_ids": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "minItems": 2,
                    "maxItems": 5,
                    "description": "房源 ID 列表, 至少 2 个, 最多 5 个",
                },
            },
            "required": ["listing_ids"],
        },
    },
}

# ---------- 4. add_to_wishlist ----------
add_to_wishlist = {
    "type": "function",
    "function": {
        "name": "add_to_wishlist",
        "description": (
            "把某个房源加入心愿单 (用户的某心愿单)。"
            "当用户说'加到东京旅行'/'加入心愿单'/'收藏' 时, 必须使用此工具。"
            "注意:用户必须已登录, 且 wishlist_id 来自 list_wishlists 或 create_wishlist。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "wishlist_id": {
                    "type": "integer",
                    "description": "心愿单 ID (调 list_wishlists 或 create_wishlist 获取)",
                },
                "listing_id": {"type": "integer", "description": "房源 ID"},
            },
            "required": ["wishlist_id", "listing_id"],
        },
    },
}

# ---------- 5. remove_from_wishlist ----------
remove_from_wishlist = {
    "type": "function",
    "function": {
        "name": "remove_from_wishlist",
        "description": "从心愿单移除某个房源。",
        "parameters": {
            "type": "object",
            "properties": {
                "wishlist_id": {"type": "integer", "description": "心愿单 ID"},
                "listing_id": {"type": "integer", "description": "房源 ID"},
            },
            "required": ["wishlist_id", "listing_id"],
        },
    },
}

# ---------- 6. list_wishlists ----------
list_wishlists = {
    "type": "function",
    "function": {
        "name": "list_wishlists",
        "description": (
            "查看当前用户的所有心愿单及其中的房源。"
            "当用户问'我的心愿单'/'我保存过哪些'/'我的收藏', 必须先调此工具获取 wishlist_id。"
        ),
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
}

# ---------- 7. create_wishlist ----------
create_wishlist = {
    "type": "function",
    "function": {
        "name": "create_wishlist",
        "description": (
            "创建一个新的心愿单。"
            "当用户说'新建一个心愿单'/'创建收藏夹'/'建个列表叫 xxx' 时, 使用此工具。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "心愿单名称, 如 '东京旅行' / '巴黎度假'",
                },
            },
            "required": ["name"],
        },
    },
}

# ---------- 8. create_booking ----------
create_booking = {
    "type": "function",
    "function": {
        "name": "create_booking",
        "description": (
            "为用户预订某个房源。"
            "**触发 Human-in-the-loop**: 必须先向用户确认房源、日期、人数、价格, "
            "得到用户明确同意后才下单。如果信息不全, 先用 search_listings / 追问补全。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "listing_id": {"type": "integer", "description": "房源 ID"},
                "check_in": {"type": "string", "description": "入住日期 YYYY-MM-DD"},
                "check_out": {"type": "string", "description": "退房日期 YYYY-MM-DD"},
                "guests": {"type": "integer", "minimum": 1, "description": "入住人数"},
            },
            "required": ["listing_id", "check_in", "check_out", "guests"],
        },
    },
}

# ---------- 9. list_my_trips ----------
list_my_trips = {
    "type": "function",
    "function": {
        "name": "list_my_trips",
        "description": (
            "查看当前用户的所有预订 (Trips)。"
            "当用户问'我的订单'/'我的旅行'/'我的预订', 必须使用此工具。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "include_cancelled": {
                    "type": "boolean",
                    "default": True,
                    "description": "是否包含已取消订单, 默认 True",
                },
            },
        },
    },
}

# ---------- 10. parse_travel_plan_pdf ----------
parse_travel_plan_pdf = {
    "type": "function",
    "function": {
        "name": "parse_travel_plan_pdf",
        "description": (
            "从旅行计划文本中抽取结构化字段: 目的地、日期、预算、人数、主题。"
            "参数 plan_text 是已抽取的文本内容 (不是文件路径)."
            "**用法**: 用户上传 PDF 时, PDF 文本已经 inline 在用户消息里 (``` 代码块包裹), "
            "直接提取 ``` 里的内容作为 plan_text 调用本工具, 得到结构化字段. "
            "用户粘贴/输入旅行计划文字时, 也直接调这个工具."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "plan_text": {
                    "type": "string",
                    "description": "旅行计划文本内容 (PDF 抽取的全文 或 用户粘贴的文字)",
                },
            },
            "required": ["plan_text"],
        },
    },
}

# ---------- 11. recommend_from_plan ----------
recommend_from_plan = {
    "type": "function",
    "function": {
        "name": "recommend_from_plan",
        "description": (
            "基于旅行计划文本推荐房源. 自动抽取城市/关键词, 调 search_listings 找匹配."
            "参数 plan_text 是旅行计划内容 (同 parse_travel_plan_pdf 的 plan_text)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "plan_text": {
                    "type": "string",
                    "description": "旅行计划文本内容 (同 parse_travel_plan_pdf)",
                },
                "max_results": {
                    "type": "integer",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 20,
                    "description": "返回推荐条数",
                },
            },
            "required": ["plan_text"],
        },
    },
}

# ---------- 12. search_travel_tips (RAG) ----------
search_travel_tips = {
    "type": "function",
    "function": {
        "name": "search_travel_tips",
        "description": (
            "从旅行知识库 (travel_tips 表) 检索相关贴士: 签证、当地交通、美食、安全、文化等。"
            "用于回答用户的旅行常识问题, 如 '东京需要签证吗'/'巴黎地铁怎么坐'/'泰国安全吗'。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "旅行问题"},
                "top_k": {
                    "type": "integer",
                    "default": 3,
                    "minimum": 1,
                    "maximum": 10,
                    "description": "返回条数, 默认 3",
                },
            },
            "required": ["query"],
        },
    },
}


# ---------- 13. check_availability (Block 33) ----------
check_availability = {
    "type": "function",
    "function": {
        "name": "check_availability",
        "description": (
            "查询某套房源在指定日期段**有没有空位**（能否预订），有空位时同时返回实时价格明细"
            "（每晚价 × 晚数 + 清洁费 + 服务费 = 总价）。"
            "当用户问'这几天/某日期有没有空'、'能订吗'、或下单前想确认价格时，必须使用此工具。"
            "注意：与 create_booking 用同一套占位规则，此处 available=true 不代表锁定，下单仍走 HITL 确认。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "listing_id": {"type": "integer", "description": "房源 ID"},
                "check_in": {"type": "string", "description": "入住日期 YYYY-MM-DD（不能早于今天）"},
                "check_out": {"type": "string", "description": "退房日期 YYYY-MM-DD（必须晚于入住）"},
            },
            "required": ["listing_id", "check_in", "check_out"],
        },
    },
}

# ---------- 14. get_listing_calendar (Block 33) ----------
get_listing_calendar = {
    "type": "function",
    "function": {
        "name": "get_listing_calendar",
        "description": (
            "查看某套房源**未来一段时间**的可订日历：哪些日期段已被预订（occupied_ranges）、"
            "剩余可订天数、当前每晚价。当用户问'这个房源什么时候有空'、'看看它的可订日历'、"
            "'哪些日期被订了'，或需要帮用户挑一个有空位的日期段时，使用此工具。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "listing_id": {"type": "integer", "description": "房源 ID"},
                "days": {
                    "type": "integer",
                    "default": 30,
                    "minimum": 1,
                    "maximum": 90,
                    "description": "往前看多少天, 默认 30, 最大 90",
                },
            },
            "required": ["listing_id"],
        },
    },
}


# ============ 全部 schemas (Block 9 orchestrator 直接用) ============

ALL_TOOL_SCHEMAS: list[dict] = [
    search_listings,
    get_listing_detail,
    compare_listings,
    add_to_wishlist,
    remove_from_wishlist,
    list_wishlists,
    create_wishlist,
    create_booking,
    list_my_trips,
    parse_travel_plan_pdf,
    recommend_from_plan,
    search_travel_tips,
    check_availability,
    get_listing_calendar,
]


# ============ 工具名白名单 (Block 9 orchestrator 路由用) ============

TOOL_NAMES: list[str] = [t["function"]["name"] for t in ALL_TOOL_SCHEMAS]
