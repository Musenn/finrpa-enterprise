# Day 10 — Workflow Templates & Skill Library 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/workflows/schemas.py` | 模板数据结构（WorkflowTemplate/ParamDefinition/SkillStepDefinition），6 种参数类型 |
| `enterprise/workflows/templates.py` | 6 个行业模板（银行 2/保险 2/证券 2）+ TEMPLATE_REGISTRY 注册表 |
| `enterprise/workflows/crypto.py` | Fernet 对称加密（敏感参数加解密 + API 响应掩码显示） |
| `enterprise/workflows/validator.py` | 三层参数校验引擎（必填项/类型格式/业务规则 + 自定义正则） |
| `enterprise/workflows/routes.py` | 工作流 API（GET /templates + GET /templates/{id} + POST /instantiate/{id}） |
| `enterprise/skills/__init__.py` | Skill 库模块初始化 |
| `enterprise/skills/base.py` | BaseSkill 基类（统一接口 + 审计输出 + 错误策略） |
| `enterprise/skills/auth_skills.py` | 认证技能（LoginSkill 通用登录 + SessionKeepAliveSkill 会话保活） |
| `enterprise/skills/interaction_skills.py` | 交互技能（FormFillSkill 表单填写 + SearchAndSelectSkill 搜索选择 + PaginationSkill 翻页） |
| `enterprise/skills/extraction_skills.py` | 提取技能（TableExtractSkill 表格提取 + FileDownloadSkill 文件下载） |
| `enterprise/skills/executor.py` | Skill Pipeline 执行器（按序执行/错误策略/审计回调） |
| `tests/unit/test_workflows.py` | 工作流模板测试（模板注册/参数校验/加密解密/API 实例化） |
| `tests/unit/test_skills.py` | Skill 库测试（基类接口/各 Skill 执行/Pipeline 流程） |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern/forge/api_app.py` | 注册工作流模板路由到 `/api/v1` 前缀 |
