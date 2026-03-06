# Day 1 — 项目初始化

## 今日改动

完成项目骨架搭建，核心工作分三部分：

1. **Skyvern 底座集成**：将 Skyvern 源码（skyvern/、alembic/、skyvern-frontend/、Dockerfile）直接拷贝到项目中，作为二次开发的起点
2. **Enterprise 扩展层**：在项目根目录创建独立的 `enterprise/` 包，内含 7 个功能子模块（auth、tenant、approval、audit、dashboard、llm、workflows），后续所有金融场景的定制代码均落在此目录下，不侵入 Skyvern 核心
3. **容器化开发环境**：编写 docker-compose.yml，包含 PostgreSQL 14、Redis 7、MinIO、Skyvern、Skyvern-UI 五个服务，配置完整的 healthcheck 与依赖启动顺序，`make dev` 一键拉起

配套产出：`.env.example`（全量配置模板）、`pyproject.toml`（依赖管理，新增 minio、passlib、redis、python-jose）、`Makefile`（dev/test/lint/migrate/seed 等常用命令）、`.gitignore`、tests 目录结构及 conftest.py。

## 设计决策

### Skyvern 集成方式：直接拷贝 vs Git Submodule

最终选择直接拷贝源码。对比考虑如下：

- **clone 门槛**：submodule 要求使用者 clone 时附加 `--recurse-submodules`，遗漏则缺少文件，增加上手成本
- **后续改动需求**：Day 8 需要在 Skyvern 的 action 执行链路中植入审计钩子，Day 9 需要扩展任务状态枚举——这些改动发生在 Skyvern 内部。若使用 submodule，需先 fork 上游仓库再修改，引入额外的仓库管理成本
- **项目定位**：本项目是基于 Skyvern 的企业级二次开发，不需要持续同步上游更新，直接拷贝更为简洁

### Docker 卷策略：Named Volume vs Bind Mount

选择 named volume。在 Windows 开发环境下，bind mount（如 `./postgres-data`）存在文件权限不兼容的问题，PostgreSQL 容器启动时容易出现 permission denied 错误。Named volume 由 Docker 引擎管理，规避了宿主机与容器的权限模型差异，且 `docker compose down -v` 即可完成清理。

### Redis 持久化配置

开启 AOF 持久化（`appendonly yes`）并设置 256MB 内存上限。Day 6 的审批引擎依赖 Redis Pub/Sub 传递审批消息，若使用纯内存模式，开发过程中 Redis 容器意外重启将导致进行中的审批状态丢失。AOF 持久化在开发阶段提供了基本的数据安全保障。

## 金融企业场景下的工程意义

项目初始化看似基础，但在银行、保险等金融机构的技术团队中，这一阶段的决策直接影响后续数月的开发效率和系统可维护性。

**环境一致性**：多人协作时，开发环境不一致是常见的效率杀手——PostgreSQL 小版本差异、Redis 配置不同步等问题往往在集成阶段才暴露。Docker Compose + `.env.example` 将完整的运行环境固化为代码，团队成员获得一致的开发环境。

**模块化边界**：金融 RPA 系统涉及权限、审批、审计等多个交叉领域，若不在早期规划清晰的目录结构，代码膨胀后模块边界模糊，定位和修改特定功能的成本急剧上升。`enterprise/` 按功能域划分子模块，各模块职责明确，支持团队并行开发。

**底座与扩展解耦**：在开源项目上做企业级扩展时，若将定制逻辑与原始代码混编，后续的维护和溯源成本很高。将扩展代码隔离到独立目录、对 Skyvern 核心仅做最小改动，是保持长期可维护性的基本原则。

## 踩坑记录

1. **conda 清华镜像 403**：`.condarc` 中配置的清华 Anaconda 镜像全线返回 HTTP 403。解决方案：在 `conda create` 时指定官方源 `https://conda.anaconda.org/conda-forge` 并附加 `--override-channels` 参数，绕过本地镜像配置
2. **`.env.*` 通配符误伤**：`.git/info/exclude` 中的 `.env.*` 规则将 `.env.example` 一并排除，导致该文件无法被 git 追踪。修复方式：追加 `!.env.example` 取消对该文件的排除
