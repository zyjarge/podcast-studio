from typing import Annotated, TypedDict, List
from langgraph.graph.message import add_messages

class PodcastState(TypedDict):
    # 原始抓取的新闻列表
    news_list: List[dict]
    # 精选并生成的深度摘要
    summaries: List[str]
    # 节目大纲
    outline: str
    # 逐步生成的对话脚本片段 (用于长文本逻辑)
    script_segments: List[dict]
    # 最终合并的全文
    final_script: str
