# Day 1 — 项目初始化

## 今天干了什么

把整个项目骨架搭好了。说白了就是三件事：

1. 把 Skyvern 的源码拉下来放进项目里，作为我们的底座
2. 在旁边建了一个 `enterprise/` 目录，后续所有金融场景的扩展代码全部放这里面，不动 Skyvern 的核心
3. 写好了 Docker Compose，PostgreSQL、Redis、MinIO、Skyvern、前端 UI 五个容器一把拉起来，`make dev` 搞定

另外配套的东西也一并到位了：`.env.example`（配置模板）、`pyproject.toml`（依赖管理）、`Makefile`（常用命令封装）、测试目录结构。

## 几个关键决策，说说为什么

### 为什么直接拷贝 Skyvern 源码，而不用 Git Submodule？

这个问题我纠结过。submodule 看上去更"优雅"，但实际操作下来有几个坑：

第一，submodule 要求别人 clone 的时候加 `--recurse-submodules`，不加就缺文件。对于一个想让人快速上手看的项目来说，多一步就多一个劝退点。

第二，我们后面 Day 8 做审计的时候要在 Skyvern 的 action 执行链路里加钩子，Day 9 要扩展任务状态枚举——这些都需要改 Skyvern 内部代码。如果用 submodule，改人家的代码得先 fork 一份上游仓库，管两个仓库，没必要。

第三，这个项目的定位是"基于 Skyvern 的企业级二次开发"，不需要持续跟踪上游的 commit。直接拷贝一份，后面在上面改就行了。

### Docker 为什么用 Named Volume 而不是 Bind Mount？

在 Windows 上踩过一次坑。用 `./postgres-data` 这种 bind mount 的方式，PostgreSQL 启动的时候经常报权限错误，因为 Windows 文件系统的权限模型和 Linux 容器里的不一样。换成 named volume 就没这个问题了，Docker 自己管理存储，`docker compose down -v` 一把删干净。

### Redis 为什么开 AOF 持久化？

后面 Day 6 要做审批引擎，审批消息走 Redis Pub/Sub。如果 Redis 是纯内存模式，开发的时候不小心重启一下容器，正在等审批的任务就全丢了。开了 `appendonly yes` 加个 256MB 的内存上限，开发体验好很多，不怕数据丢。

## 这些东西在银行实际项目里解决什么问题

搭项目骨架这件事听起来很基础，但在银行的技术团队里，这恰恰是很多项目后期混乱的根源。

**环境不统一的问题**：我见过好几个团队，开发到中后期发现"在我电脑上能跑在你那跑不了"，排查半天发现是 PostgreSQL 版本差了一个小版本、Redis 没开持久化之类的破事。Docker Compose + `.env.example` 从第一天就把环境锁死，所有人的开发环境一模一样。

**代码散乱的问题**：没有提前规划目录结构的项目，三四个人同时开发一个月以后，权限相关的代码散落在五六个目录里，谁也说不清楚完整的逻辑在哪。`enterprise/` 下面按功能域划分子模块（auth、tenant、approval……），每个人负责自己的模块，互相不踩脚。

**底座和扩展混在一起的问题**：直接在 Skyvern 的代码上大刀阔斧地改，短期看是快了，但以后想升级 Skyvern 修 bug 的时候就会发现自己的改动和上游的改动搅在一起，根本理不清。把企业扩展放在独立的 `enterprise/` 目录，Skyvern 核心只做必要的最小改动，这个架构边界后面会一直受益。

## 踩坑

1. **conda 清华镜像挂了**：`.condarc` 里配的清华源全线 403，创建虚拟环境的时候死活拉不到包。解决办法是指定官方源 `https://conda.anaconda.org/conda-forge` 并加 `--override-channels` 绕过本地配置
2. **Windows 下 `.env.*` 通配符太贪婪**：`.git/info/exclude` 里写 `.env.*` 会把 `.env.example` 也排除掉，导致这个文件死活不出现在 `git status` 里。加一行 `!.env.example` 取消排除就好了
