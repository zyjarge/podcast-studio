# 逐字稿 Inline 编辑功能开发总结

> 开发日期: 2026-02-27 | 功能状态: ✅ 已完成

---

## 一、功能概述

在 EpisodeDetail 页面实现了**逐字稿 inline 编辑**功能，用户可以直接在页面内编辑 AI 生成的逐字稿，无需跳转或弹窗。

---

## 二、后端实现

### 2.1 新增 API

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/api/v1/episodes/{episode_id}/news/{news_id}/script` | 更新逐字稿内容 |

### 2.2 请求/响应示例

**请求:**
```bash
curl -X PUT "http://localhost:8002/api/v1/episodes/1/news/1/script" \
  -H "Content-Type: application/json" \
  -d '{"script":"这是修改后的逐字稿内容"}'
```

**响应:**
```json
{
  "script": "这是修改后的逐字稿内容",
  "status": "pending"
}
```

### 2.3 代码修改

**文件:** `backend/app/api/v1/endpoints/episodes.py`

```python
@router.put("/{episode_id}/news/{news_id}/script")
def update_script(
    episode_id: int,
    news_id: int,
    script: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Update the script for a specific news item (inline editing)
    """
    episode_news = db.query(EpisodeNews).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.news_id == news_id
    ).first()
    
    if not episode_news:
        raise HTTPException(status_code=404, detail="News not found in episode")
    
    episode_news.script = script
    db.commit()
    db.refresh(episode_news)
    
    return {"script": episode_news.script, "status": episode_news.status.value}
```

---

## 三、前端实现

### 3.1 UI 设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✏️ 逐字稿                                         [编辑]                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │  男：各位听众朋友大家好...                                          │   │
│  │  女：今天我们来聊聊...                                              │   │
│  │  男：...                                                            │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

编辑模式下:
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✏️ 逐字稿                                    [取消] [保存]                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │  <textarea>                                                        │   │
│  │  男：各位听众朋友大家好...                                          │   │
│  │  女：今天我们来聊聊...                                              │   │
│  │  男：...                                                            │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 新增状态

```javascript
// 脚本编辑状态
const [editingScript, setEditingScript] = useState(false)  // 是否在编辑模式
const [editedScript, setEditedScript] = useState('')       // 编辑中的内容
const [savingScript, setSavingScript] = useState(false)    // 保存中状态
```

### 3.3 新增函数

| 函数 | 说明 |
|------|------|
| `startEditScript()` | 开始编辑，复制当前脚本到编辑区 |
| `cancelEditScript()` | 取消编辑，放弃修改 |
| `saveScript()` | 保存修改到后端 |

### 3.4 代码修改

**文件:** `frontend/src/pages/EpisodeDetail.jsx`

1. 添加新图标: `Save`, `RotateCcw`
2. 添加编辑状态变量
3. 添加编辑/保存/取消函数
4. 替换静态 `<pre>` 为可编辑的 `<textarea>`

---

## 四、前端 API 调用

**文件:** `frontend/src/services/api.js`

```javascript
// Script operations
updateScript: (episodeId, newsId, script) => 
  request(`/episodes/${episodeId}/news/${newsId}/script`, { 
    method: 'PUT', 
    body: { script }
  }),
```

---

## 五、测试验证

### 5.1 API 测试

```bash
# 测试更新脚本
curl -X PUT "http://localhost:8002/api/v1/episodes/1/news/1/script" \
  -H "Content-Type: application/json" \
  -d '{"script":"测试内容"}'

# 响应
{"script":"测试内容","status":"pending"}
```

### 5.2 前端测试

- [x] 页面加载正常
- [x] 点击"编辑"按钮进入编辑模式
- [x] textarea 可正常输入
- [x] 点击"保存"调用 API
- [x] 点击"取消"放弃修改
- [x] 保存后自动退出编辑模式

---

## 六、使用说明

1. 在节目详情页，选择左侧新闻
2. 在右侧找到"逐字稿"区域
3. 点击右上角的"编辑"按钮
4. 在文本框中修改内容
5. 点击"保存"保存修改，或"取消"放弃

---

## 七、后续优化建议

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 版本管理 | P1 | 保存历史版本，支持回退 |
| 快捷键 | P2 | Ctrl+S 保存，Esc 取消 |
| 自动保存 | P2 | 输入一段时间后自动保存 |
| 字数统计 | P2 | 显示当前字数和预计朗读时长 |

