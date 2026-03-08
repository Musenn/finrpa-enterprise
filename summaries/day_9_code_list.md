# Day 9 — LLM Resilience & Dual-Agent 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/llm/task_states.py` | 企业任务状态机（3 个扩展状态 + 22 条转换路径 + validate_transition 校验） |
| `enterprise/llm/resilient_caller.py` | 三层 LLM 容错调用器（Prompt 约束 → JSON 解析校验 → 指数退避重试 → NEEDS_HUMAN 降级） |
| `enterprise/llm/model_router.py` | 页面复杂度模型路由（5 个 DOM 特征评估 → SIMPLE/MODERATE/COMPLEX → 三级模型层级） |
| `enterprise/llm/human_intervention.py` | 人工处置模块（StuckTaskInfo + 3 种处置方式：SKIP_STEP/MANUAL_COMPLETE/TERMINATE） |
| `enterprise/agent/__init__.py` | 双 Agent 模块初始化 |
| `enterprise/agent/schemas.py` | Agent 数据结构（SubTask/SubTaskResult/PlanResult/ExecutionResult） |
| `enterprise/agent/planner.py` | PlannerAgent：LLM 驱动的任务拆解，生成有序子任务列表 |
| `enterprise/agent/executor.py` | ExecutorAgent：逐步执行子任务，返回结构化结果 |
| `enterprise/agent/coordinator.py` | AgentCoordinator：编排 Planner+Executor 通信，处理 4 种失败策略（retry/skip/abort/replan） |
| `tests/unit/test_llm_resilience.py` | LLM 容错测试（状态机/重试/降级/模型路由） |
| `tests/unit/test_agent.py` | 双 Agent 测试（规划/执行/协调/重规划/降级） |
