# Day 14 — 容器化完善与项目收尾

## 今日改动

完成生产环境容器化配置、端到端集成测试、文档更新三项收尾工作：

1. **生产 Docker Compose**：`docker-compose.prod.yml` 作为开发环境的 override 层，关键调整包括——PostgreSQL 启用 `scram-sha-256` 认证并调优连接池（`max_connections=200`、`shared_buffers=256MB`、慢查询日志阈值 1s）、Redis 内存上限提升至 512MB 并配置多级 RDB 快照策略（900/1 + 300/10 + 60/10000）、MinIO 关闭外部端口暴露（仅内部网络访问）、Skyvern 切换 production 模式（`LOG_LEVEL=WARNING`、`ENABLE_CODE_BLOCK=false`）并设置数据库连接池参数（pool_size=20、max_overflow=30）、所有服务统一 `restart: always` 并配置内存上限

2. **Nginx 反向代理**：`nginx/nginx.conf` + `nginx/conf.d/default.conf` 实现统一入口——API 请求（/api/、/v1/）代理到 skyvern:8000，前端请求代理到 skyvern:8080 并支持 WebSocket 升级。启用 gzip 压缩、安全响应头（X-Frame-Options、X-Content-Type-Options、X-XSS-Protection、Referrer-Policy）、50MB 上传限制。HTTPS/SSL 配置预留注释块，证书目录 `nginx/certs/` 通过 `.gitkeep` 占位

3. **Makefile 扩展**：新增 `dev-prod`（生产模式启动）、`frontend-build`、`frontend-test` 三个目标，覆盖前后端全流程操作

4. **端到端集成测试**：`tests/integration/test_e2e_flow.py` 共 10 个测试类、40 个测试用例，按业务流程分为 10 个阶段验证——认证签发（5）→风险识别（4）→审批路由（4）→租户隔离（5）→审计脱敏（6）→LLM 容错（4）→Action 缓存（4）→Dashboard 统计（3）→工作流模板（3）→完整生命周期（2）。最终的 `TestPhase10FullE2EScenario` 模拟完整业务链路：操作员登录→高危操作触发→审批路由→审批员权限验证→审计脱敏→Action 缓存→Dashboard 数据→租户隔离验证→风控只读验证

5. **README 更新**：补充生产部署章节（Docker Compose prod overlay、Nginx 反向代理、HTTPS 证书配置、资源限制说明）、项目架构图（enterprise 模块层次）、Makefile 命令速查表、测试与质量保障数据

最终测试结果：601 个测试全部通过（561 单元 + 40 端到端集成），enterprise 包覆盖率 85%（目标 ≥ 70%）。

## 设计决策

### docker-compose.prod.yml 作为 override 而非独立文件

生产配置采用 Docker Compose 官方推荐的 multi-file overlay 模式（`-f docker-compose.yml -f docker-compose.prod.yml`），而非单独维护一个完整的生产 compose 文件。对比如下：

- **独立文件**：所有服务定义重复一遍，开发环境修改服务配置时生产文件不会同步，容易出现配置漂移
- **Override 模式**（当前方案）：生产文件只写差异项（restart 策略、资源限制、环境变量覆盖），基础服务定义始终与开发环境一致，修改一处自动生效两处

### Nginx 端口收敛策略

生产环境通过 Nginx 将所有流量收敛到 80/443 两个端口，Skyvern API（8000）和前端（8080）不直接暴露。理由：

- 减少攻击面：外部只需开放两个端口，内部服务端口仅限 Docker 网络访问
- 统一 HTTPS 终结点：SSL 证书在 Nginx 层统一处理，后端服务无需各自配置 TLS
- 运维简化：日志、限流、安全头等横切关注点集中在 Nginx 处理

### PostgreSQL 生产调优参数选择

`shared_buffers=256MB` + `effective_cache_size=768MB` + `work_mem=4MB` 是针对 1GB 内存限制（deploy.resources.limits.memory）的保守配置。PostgreSQL 官方建议 `shared_buffers` 设为可用内存的 25%，`effective_cache_size` 设为 75%。`log_min_duration_statement=1000` 记录超过 1 秒的慢查询，便于后续性能分析。

这组参数适用于中小规模部署（单机 50-100 并发用户）。若组织规模更大，需要调整 `max_connections` 并考虑引入 PgBouncer 连接池中间件。

### 端到端测试的分层验证策略

`test_e2e_flow.py` 没有采用单一的超长测试函数来模拟全流程，而是按业务阶段拆分为 10 个独立的测试类。原因：

- **故障定位**：某个阶段失败时，测试名称直接指向失败环节（如 `TestPhase3TenantIsolation`），无需翻阅长日志
- **并行执行**：各阶段互不依赖（通过 fixture 提供独立上下文），pytest 可并行运行
- **最后兜底**：`TestPhase10FullE2EScenario` 作为最终的全链路验证，确保各阶段衔接无缝

## 金融企业场景下的工程意义

**一键部署降低运维门槛**：银行科技部门的运维团队通常按标准化流程操作，`make dev-prod` 一条命令启动完整环境（含数据库调优、缓存持久化、反向代理），消除了手动配置各服务参数的出错空间。HTTPS 配置以注释形式预留，运维人员只需取消注释并挂载证书文件即可启用加密传输——这种"开箱即安全"的设计思路减少了安全配置遗漏的风险。

**资源隔离与成本可控**：每个服务设置了明确的内存上限（PostgreSQL 1GB、Redis 768MB、MinIO 512MB、Skyvern 4GB、Nginx 128MB），总计约 6.4GB，适配银行常见的 8-16GB 部署虚拟机规格。资源限制防止单个服务内存泄漏导致其他服务被 OOM Kill，这在无人值守的 RPA 环境中尤为重要。

**端到端测试覆盖合规审查要求**：金融机构的系统上线前通常需要提供完整的测试报告，证明核心业务流程（登录→操作→审批→审计）全链路可追溯。`test_e2e_flow.py` 的 10 阶段验证正好对应合规审查的关注点，测试通过即可作为上线依据的一部分。85% 的代码覆盖率超过行业通常要求的 70% 基线。

**Nginx 安全响应头的合规价值**：`X-Frame-Options: SAMEORIGIN` 防止点击劫持、`X-Content-Type-Options: nosniff` 防止 MIME 类型混淆、`Referrer-Policy: strict-origin-when-cross-origin` 防止敏感 URL 泄露——这些头部是金融行业安全评审的常规检查项，提前配置避免上线前补救。

## 踩坑记录

1. **MinIO 健康检查命令在生产 overlay 中的行为**：`docker-compose.prod.yml` 中设置 `ports: []` 清空 MinIO 的端口映射后，宿主机无法通过 `curl localhost:9000` 检查健康状态（`make health` 中的检查项），但容器内部的 healthcheck（`mc ready local`）不受影响。解决方式：`make health` 的 MinIO 检查在生产模式下改为通过 `docker compose exec` 在容器内执行，而非从宿主机直接 curl

2. **Redis RDB 快照配置语法**：`docker-compose.prod.yml` 中 Redis 的 `command` 字段使用 YAML 多行字符串（`>`），`--save 900 1` 等参数需要确保每个参数之间用空格分隔而非换行。最初使用 `|` 多行格式导致每行被当作独立参数传入 redis-server，启动失败。改用 `>` 折叠换行后正常
