# Day 14 — Production Ready 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `docker-compose.prod.yml` | 生产 Docker Compose override（PostgreSQL 调优/Redis 持久化/MinIO 端口隔离/资源限制） |
| `nginx/nginx.conf` | Nginx 主配置（gzip 压缩/安全响应头/上传限制） |
| `nginx/conf.d/default.conf` | Nginx 虚拟主机（API 反向代理/前端代理/WebSocket 升级/HTTPS 预留） |
| `nginx/certs/.gitkeep` | SSL 证书目录占位 |
| `tests/integration/test_e2e_flow.py` | 端到端集成测试（10 个阶段/40 个用例：认证→风险→审批→隔离→审计→LLM→缓存→统计→模板→全链路） |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `Makefile` | 新增 dev-prod/frontend-build/frontend-test 目标 |
| `README.md` | 补充生产部署章节/架构图/Makefile 速查表/测试指标 |
