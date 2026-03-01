"""
新闻价值评分服务
基于来源权威性、时效性、内容深度计算评分
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.models import News, RSSSource
import logging

logger = logging.getLogger(__name__)


# 来源权威性白名单 (域名 -> 分数)
AUTHORITY_WHITELIST = {
    # 科技
    "36kr.com": 95,
    "tech.36kr.com": 95,
    "tuchong.com": 90,  # 虎嗅
    "huxiu.com": 90,
    "tech.qq.com": 85,  # 腾讯科技
    "tech.sina.com.cn": 80,
    "ifeng.com": 75,
    "ithome.com": 85,  # IT之家
    "leiphone.com": 80,  # 雷锋网
    "jiemian.com": 85,  # 界面
    "pingwest.com": 80,  # 品玩
    "yicai.com": 85,  # 第一财经
    "cls.cn": 80,  # 财经网
    "wallstreetcn.com": 85,  # 华尔街见闻
    "xueqiu.com": 75,  # 雪球
    "zhihu.com": 70,
    "weibo.com": 50,
    # 国际
    "reuters.com": 95,
    "bloomberg.com": 95,
    "wsj.com": 90,
    "ft.com": 90,
    " economist.com": 90,
    "theverge.com": 85,
    "techcrunch.com": 85,
    "wired.com": 85,
    "ars Technica": 80,
    "engadget.com": 80,
}


class NewsScorer:
    """新闻评分器"""
    
    # 评分权重
    WEIGHT_AUTHORITY = 0.35    # 来源权威性
    WEIGHT_TIMELINESS = 0.35   # 时效性
    WEIGHT_DEPTH = 0.30        # 内容深度
    
    def __init__(self, db: Session):
        self.db = db
    
    def _get_domain_authority(self, url: str) -> float:
        """获取域名权威性评分"""
        try:
            # 提取域名
            domain = url.lower()
            if "://" in domain:
                domain = domain.split("://")[1]
            domain = domain.split("/")[0]
            
            # 移除 www. 前缀
            if domain.startswith("www."):
                domain = domain[4:]
            
            # 精确匹配
            if domain in AUTHORITY_WHITELIST:
                return AUTHORITY_WHITELIST[domain]
            
            # 部分匹配 (检查后缀)
            for whitelisted, score in AUTHORITY_WHITELIST.items():
                if domain.endswith(whitelisted) or whitelisted in domain:
                    return score
            
            # 未知来源，默认中等偏低
            return 40.0
            
        except Exception as e:
            logger.warning(f"解析域名权威性失败: {e}")
            return 40.0
    
    def _calc_timeliness(self, published_at: datetime | None) -> float:
        """计算时效性评分 (0-100)"""
        if not published_at:
            return 50.0
        
        now = datetime.utcnow()
        age_hours = (now - published_at).total_seconds() / 3600
        
        if age_hours <= 1:
            return 100.0
        elif age_hours <= 6:
            return 95.0
        elif age_hours <= 12:
            return 85.0
        elif age_hours <= 24:
            return 70.0
        elif age_hours <= 48:
            return 50.0
        elif age_hours <= 72:
            return 30.0
        else:
            return 10.0
    
    def _calc_depth(self, content: str | None) -> float:
        """计算内容深度评分 (0-100)"""
        if not content:
            return 20.0
        
        content_len = len(content)
        
        # 按字数评分
        if content_len >= 3000:
            return 100.0
        elif content_len >= 2000:
            return 85.0
        elif content_len >= 1000:
            return 70.0
        elif content_len >= 500:
            return 50.0
        elif content_len >= 200:
            return 30.0
        else:
            return 15.0
    
    def score_news(self, news: News) -> dict:
        """对单条新闻评分"""
        # 1. 来源权威性
        authority = self._get_domain_authority(news.url)
        
        # 2. 时效性
        timeliness = self._calc_timeliness(news.created_at)
        
        # 3. 内容深度
        depth = self._calc_depth(news.content or news.summary)
        
        # 加权计算总分
        total = (
            authority * self.WEIGHT_AUTHORITY +
            timeliness * self.WEIGHT_TIMELINESS +
            depth * self.WEIGHT_DEPTH
        )
        
        return {
            "score": round(total, 1),
            "score_authority": round(authority, 1),
            "score_timeliness": round(timeliness, 1),
            "score_depth": round(depth, 1),
            "score_updated_at": datetime.utcnow()
        }
    
    def score_all_news(self, limit: int = 100) -> int:
        """批量评分所有新闻"""
        news_list = self.db.query(News).order_by(News.created_at.desc()).limit(limit).all()
        
        count = 0
        for news in news_list:
            scores = self.score_news(news)
            news.score = scores["score"]
            news.score_authority = scores["score_authority"]
            news.score_timeliness = scores["score_timeliness"]
            news.score_depth = scores["score_depth"]
            news.score_updated_at = scores["score_updated_at"]
            count += 1
        
        self.db.commit()
        logger.info(f"完成 {count} 条新闻评分")
        return count
    
    def to_stars(self, score: float) -> int:
        """将分数转换为星级 (1-5)"""
        if score >= 90:
            return 5
        elif score >= 75:
            return 4
        elif score >= 60:
            return 3
        elif score >= 40:
            return 2
        else:
            return 1
