# Supervision Circle

五人月度导师会议排期工具。每月收集真实时间偏好，由组织者选定时间，再手动更新 Outlook。

React / TypeScript · Cloudflare Workers + D1 · 英文界面 · 手机可用

网站主页：<https://supervisioncircle.lidifei-ye.workers.dev>。已有小组请使用管理页复制的完整共享链接，不要重新创建小组。

- [使用说明（中文）](docs/使用说明.md)：创建月份、邀请导师、补充回复、选定时间、更新 Outlook。
- [修改与维护（中文）](docs/修改与维护.md)：本地运行、代码位置、测试、修改后如何上线。
- [部署与网址（中文）](docs/部署与网址.md)：共享链接、管理链接、独立域名与托管边界。

## 核心功能

- 固定五人名单、每月独立投票、长期共享链接和历史月份。
- Best / Available / Need to check / Unavailable；空白单独显示 No response。
- 全员确认、需要协调、有人缺席分别列出，解释人数和姓名。
- 新增时段保留旧回复、重复时段合并、多人同时保存避免互相覆盖。
- 时间按所选时区和日期处理夏令时；默认 Europe/London，工作日 09:00–17:00，每次 45 分钟。
- 选定时间后锁定投票；“已选定”和“已发送 Outlook 邀请”是两个状态。
- 邀请和跟进文案供复制；不会自动读取日历、发邮件或修改 Outlook。

## 快速开始开发

安装 Node.js 24 和 pnpm，然后：

```sh
git clone https://github.com/yelidifei/supervisioncircle.git
cd supervisioncircle
pnpm install --frozen-lockfile
pnpm exec wrangler d1 execute DB --local --config wrangler.local.json --file drizzle/0000_chief_fixer.sql
pnpm dev
```

打开终端显示的本地地址。第一次创建测试小组；本地数据库与线上数据库相互独立。

```sh
pnpm typecheck
pnpm test
pnpm build
```

本地开发服务器运行在 `http://localhost:3000` 时，可以另开终端运行 `pnpm test:integration`。此测试只访问本地，创建隔离测试小组，并将测试凭据写入仓库外的 `../test-state.json`。

## 数据与权限

回复保存在服务器的 D1 数据库。每个小组存储在一个带版本号的记录中；每次修改基于最新记录进行条件更新。回复以单个成员、单个时段的差量提交；同一格的过期修改会被拒绝，选定时间也检查最新版本。

共享链接和管理链接具有不同的服务端权限。随机管理密钥与派生共享密钥通过 URL 的片段传递，API 使用 Authorization 请求头；数据库只保存密钥的 SHA-256 摘要。选择姓名是熟人小组的信任机制，不是身份验证：任何持有共享链接的人都能选择名单中的任何姓名并修改回复。

**不要把管理链接、共享密钥、真实小组导出或数据库文件提交到这个公开仓库。** 这里包含完整程序、数据库结构和迁移，实际成员和投票数据仍保存在托管数据库中。

## 上线说明

源码保存在本仓库，当前生产网站由 Cloudflare Workers 托管。现有小组已迁移至 Cloudflare D1；原 Sites 网站为只读存档。`.openai/hosting.json` 保留旧项目关联，**不要把旧 Sites 项目当作当前生产入口，也不要重新开启旧站写入**。

推送 GitHub 不会自动更新网站。修改后完成检查，再运行 `pnpm deploy:cloudflare`；它会先以 Cloudflare 模式构建，再部署到当前 Worker。第一次在新电脑部署前，需要登录 Cloudflare 并配置本地 `wrangler.cloudflare.json`，详见部署指南。

本站需要服务端接口和 D1，不能直接作为静态网站上传到 GitHub Pages。域名变化也不会通过修改页面标题或 README 自动发生。详见[部署与网址](docs/部署与网址.md)。
