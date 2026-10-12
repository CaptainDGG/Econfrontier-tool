# EconFrontier · GitHub / Netlify 部署包

本包用于上传至 GitHub 仓库，再通过 Netlify 部署。请先解压，不要把 ZIP 本身上传到 GitHub。
仓库根目录必须包含 dist 文件夹和 netlify.toml。Netlify 会发布 dist 内的网站文件。

网页内的体验 PIN 页面和前端校验已移除。本站部署后会直接打开主页；如果要限制访问，必须先在 Netlify 后台启用服务器侧访问保护，不能依赖本包本身。

注意：截至 2026-10，Netlify 自带的整站共享密码仅在 Pro 等支持该功能的方案可用，Credit-based Free / Personal 方案不提供此选项。若没有该功能，请不要将此包设为公开访问后再假定它受密码保护。可以升级到支持密码的方案，或另行实现服务端访问验证。

不要把任何私人 API key、访问密码或环境变量值写入 dist、netlify.toml 或 GitHub 仓库。
