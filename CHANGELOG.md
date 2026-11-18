# 更新记录

## 1.0.1

- **修复：关闭后 API Key 与聊天记录丢失。** 内置静态服务原来用随机端口启动，端口一变浏览器就把它当成另一个站点，localStorage / IndexedDB 全部读不到。现在固定使用 127.0.0.1:17890（被占用时才顺延），数据可以稳定保留。
- 新增数据迁移开关（开发者用）：--dump-storage=<json> / --load-storage=<json>，可用于把旧端口下的 localStorage 搬到新源。

## 1.0.0

- 首个版本：把 chat-demo 打包装进 Electron，固定窗口、应用图标、DeepSeek 风格主题，附带 NSIS 安装包与便携版。
