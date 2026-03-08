# Day 5 — Financial Risk Detector 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/approval/risk_keywords.py` | 三行业关键词库（银行 34 条/保险 20 条/证券 24 条）+ 金额识别引擎（正则提取+阈值判定） |
| `enterprise/approval/risk_detector.py` | 两阶段风险检测引擎：Stage 1 关键词扫描 + Stage 2 LLM 上下文分析，含保守降级策略 |
| `enterprise/approval/routing.py` | 审批路由映射（low/medium/high/critical → 对应审批流程和通知策略） |
| `tests/unit/test_risk_detector.py` | 风险检测测试（62 个用例：关键词匹配/金额识别/LLM 降级/路由映射） |
