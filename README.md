# EconFrontier · GitHub Pages 部署包

本包包含 `dist/` 网站文件和 `.github/workflows/pages.yml` 自动发布文件。网页入口已恢复体验 PIN `DJ2026`。

## 更新现有 GitHub 仓库

1. 解压 ZIP，不要把 ZIP 本身上传到 GitHub。
2. 在仓库的 **Code → Add file → Upload files** 页面，把解压后的 `dist`、`.github` 和 `README.md` 拖进上传区域，并提交修改。上传列表里应出现 `/dist/index.html`、`/dist/app.js` 和 `/.github/workflows/pages.yml`。
3. 在仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 打开 **Actions**，等待 `Deploy EconFrontier to GitHub Pages` 运行成功；然后从 **Settings → Pages** 打开网站地址。

如果仓库属于个人 GitHub Free 账户，使用 GitHub Pages 前必须把仓库设为 Public；GitHub Pro 等支持从私人仓库发布。普通 GitHub Pages 网站仍面向公众开放。

**重要：** `DJ2026` 是浏览器端的体验入口，不是访问控制。公开仓库和已发布网页中的前端代码、静态数据及该 PIN 都能被访客查看；知道网站地址的人也能绕过这个入口。不要把私人 API key 或真正需要保密的数据放进 `dist/`。
