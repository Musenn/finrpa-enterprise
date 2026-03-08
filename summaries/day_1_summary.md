# Day 1 — 项目骨架搭建

## 今日改动

完成 FinRPA Enterprise 的项目骨架搭建，将 Skyvern 开源 AI 浏览器自动化引擎集成到企业级项目框架中，核心工作分四部分：

1. **Skyvern 源码集成**：完整集成 Skyvern 核心代码——`skyvern/` Python 包（AI 浏览器操作引擎）、`skyvern-frontend/` React 前端（工作流编辑器和任务管理 UI）、`alembic/` 数据库迁移脚本。采用直接拷贝而非 Git submodule，原因是后续 Day 8-9 需要修改 Skyvern 内部代码（`api_app.py` 路由注册），submodule 模式下的修改会造成不必要的维护负担

2. **Enterprise 扩展目录**：创建 `enterprise/` 包结构，预留 7 个子模块——auth（认证）、tenant（租户隔离）、approval（审批引擎）、audit（审计日志）、dashboard（运营统计）、llm（LLM 容错）、workflows（工作流模板）。每个子模块包含 `__init__.py` 占位文件

3. **Docker 多服务环境**：`docker-compose.yml` 编排 5 个服务——PostgreSQL 14（主数据库，开启 healthcheck）、Redis 7（审批 Pub/Sub + 缓存，开启 AOF 持久化）、MinIO（审计截图私有存储，`mc ready` 健康检查）、Skyvern API（AI 引擎后端，8000 端口）、Skyvern UI（前端，8080 端口）。服务间通过 `depends_on` 和 `healthcheck` 控制启动顺序

4. **项目基础设施**：`pyproject.toml` 定义项目元数据和依赖（扩展 minio/passlib/redis）；`Makefile` 提供 dev/health/test/migrate/seed/clean 等常用命令；`.env.example` 覆盖全部配置项；`.gitignore` 排除标准开发产物；`tests/` 目录含 conftest.py 和 unit/integration 子包

## 设计决策

| 决策 | 理由 |
|------|------|
| 直接拷贝 Skyvern 源码而非 submodule | 后续需修改 `api_app.py` 注册企业路由，直接拷贝避免 submodule fork 维护负担 |
| 7 个子模块预留而非按需创建 | 模块边界在设计阶段已确定，预留目录使后续开发者一目了然项目全貌 |
| Redis 同时用于缓存和 Pub/Sub | 避免引入额外消息中间件，Redis 的 Pub/Sub 足以满足审批消息的低延迟推送需求 |
| MinIO 而非直接文件系统 | 审计截图需要结构化存储、按月归档、预签名 URL 访问控制，MinIO S3 兼容 API 提供这些能力 |
| docs/ 目录独立于 enterprise/ | 面试文档和技术文档不属于运行时代码，独立目录更清晰 |

## 踩坑记录

1. **Skyvern 依赖复杂度**：Skyvern 的 `pyproject.toml` 依赖链较深（playwright/litellm/openai 等），直接复制后需要确保 `pyproject.toml` 的依赖列表完整覆盖，否则 `pip install` 会因缺失依赖失败
2. **Docker 服务启动顺序**：MinIO 的 healthcheck 使用 `mc ready local` 命令，需要在容器内预先配置 mc alias，否则 healthcheck 永远返回 unhealthy，阻塞依赖它的服务启动
