# LexiKeep 文档目录

`docs/` 同时承担两类内容：

- `index.html`、`styles.css`、`app.js`、图片与 SEO 文件组成 GitHub Pages 产品官网。
- `PRODUCT.md` 是产品定义文档，说明目标用户、核心流程、功能边界和后续路线。

官网是无构建步骤的静态站点。修改后可在项目根目录执行：

```bash
python3 -m http.server 8000 --directory docs
```

然后访问 `http://localhost:8000` 进行本地预览。正式发布前请确认 GitHub Pages 已从 `main/docs` 部署，并检查仓库与 Releases 链接。
