# Day 11 — 运营统计后端

## 今日改动

完成运营大屏所需的全部统计 API、Redis 缓存层和 CSV 导出功能，核心工作分四部分：

1. **统计计算引擎**：`enterprise/dashboard/stats.py` 实现了 6 个统计函数——`compute_overview()`（成功率（今日/7 天/30 天）、平均执行时长、待审批数、NEEDS_HUMAN 数、按状态分布）；`compute_trend()`（按天的成功/失败折线数据，时间范围参数化）；`compute_error_distribution()`（按错误类型聚合：LLM_FAILURE / TIMEOUT / PAGE_ERROR 等）；`compute_business_line_comparison()`（各业务线任务量和成功率横向对比）；`compute_approval_response_time()`（按小时统计审批响应时间分布，24 小时热力图数据）；`compute_cost_estimation()`（按模型层级统计调用次数、缓存命中率和 LLM 费用估算）
2. **Redis 缓存层**：`enterprise/dashboard/cache.py` 实现了租户隔离的缓存方案——缓存 key 格式为 `dashboard:{org_id}:{metric}:{params_hash}`，不同组织的缓存完全隔离；相同参数的请求命中缓存（MD5 哈希匹配）；TTL 默认 60 秒；缓存读写异常被捕获并降级为直接查询，不影响主流程
3. **统计 API**：`enterprise/dashboard/routes.py` 提供 7 个端点——概览、趋势（可配置天数 1-90）、错误分布、业务线对比、审批响应时间、成本估算（均要求 operator 角色），以及 CSV 导出（要求 admin 角色）。每个端点先查缓存，miss 时计算并回写缓存
4. **CSV 导出**：`GET /enterprise/dashboard/export` 返回包含概览指标和近 30 天趋势数据的 CSV 文件，文件名包含组织 ID 和导出日期

在 `skyvern/forge/api_app.py` 中注册路由。新增测试 27 个（Day 11），累计 467 个，全部通过。

## 设计决策

### 缓存 Key 的租户隔离

缓存 key 必须包含 `org_id`，防止跨租户数据泄露。考虑过的方案：

- **按 org_id 分 Redis DB**：隔离性最强，但 Redis 默认仅 16 个 DB，不适合多租户场景
- **Key 前缀包含 org_id（当前方案）**：`dashboard:org_1:overview` 和 `dashboard:org_2:overview` 自然隔离，简单且无 DB 数量限制
- **额外好处**：运维可以通过 `KEYS dashboard:org_1:*` 快速查看某个组织的缓存状态，便于排查

### 60 秒 TTL 的选择

统计数据的时效性要求不高（分钟级即可），但 TTL 不宜过长：

- **60 秒**：大屏刷新周期通常为 30-60 秒，60s TTL 确保每次刷新至多看到 1 分钟前的数据
- **对比**：10s TTL 缓存命中率低、减少效果有限；300s TTL 在高频操作场景下数据延迟过大
- **审批等待数**：这是时效性最强的指标（审批人需要及时看到新请求），60s 延迟在可接受范围内

### 成本估算的模型价格配置

`PRICE_PER_1K` 硬编码了三个模型层级的近似价格。这是有意为之的简化——精确价格取决于具体使用的模型（Claude Haiku vs GPT-4o-mini），且价格可能随时调整。硬编码提供了"量级正确"的估算，足以支撑运营决策（如"是否值得增加更多 cache"）。生产环境应将价格配置外化到环境变量或配置文件。

### CSV 导出的权限提升

导出 API 要求 admin 角色，高于统计查看的 operator 角色。原因：

- CSV 文件一旦下载到本地，脱离了系统的访问控制
- 导出数据包含组织级别的运营指标（成功率、任务量），属于敏感经营数据
- 限制导出权限减少了数据外泄的风险面

## 金融企业场景下的工程意义

**运营可视化**：金融机构的 RPA 卓越中心（CoE）需要实时掌握自动化运行状况——哪些业务线自动化程度高、哪些时段审批积压严重、LLM 成本是否可控。6 个统计维度覆盖了 CoE 日常关注的核心指标。

**成本可控性**：LLM 调用是 RPA 系统的主要变动成本。成本估算端点结合 Day 9 的模型路由数据，让运营团队看到：轻量模型节省了多少费用、缓存命中率是否达标、重模型的使用是否合理。这些数据直接支撑 LLM 预算审批和成本优化决策。

**审批效率监控**：审批响应时间的小时分布揭示了审批人的工作模式——如果上午 10 点的平均响应时间是 5 分钟但下午 3 点是 45 分钟，可能意味着该时段审批人被其他工作占满，需要增加备用审批人或调整任务调度策略。

## 踩坑记录

1. **datetime.fromisoformat() 兼容性**：Python 3.11 的 `fromisoformat()` 支持带 `T` 分隔的 ISO 格式，但不支持带 `Z` 后缀的 UTC 标记。审批时间字段统一使用不带 `Z` 的格式以避免解析失败
2. **CSV 中文编码**：FastAPI 的 `StreamingResponse` 默认使用 UTF-8，但部分 Windows Excel 版本打开 UTF-8 CSV 会乱码。当前保持 UTF-8 输出，文档中注明 Excel 用户应使用"数据→从文本/CSV"导入功能
