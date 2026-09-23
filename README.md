# Cookie Maker

一个用于跨标签页提取和注入Cookie的Chrome扩展工具，提供直观的Cookie管理界面和数据持久化功能。

## 功能特性

- 从当前页面提取Cookie
- 向指定URL注入Cookie
- 保存Cookie集到本地存储
- 加载已保存的Cookie集
- 表格视图展示Cookie，支持勾选筛选（默认勾选 `access_token` / `refresh_token`）
- 表格中「名称」「值」点击即可复制
- 一键按名称提取并复制Token（默认 `access_token,refresh_token`，可自定义，逗号分隔）
- 一键复制JSON格式Cookie数据
- 功能按钮为图标样式，悬浮显示功能说明
- 输入区两列紧凑布局
- 自动缓存Cookie数据，切换标签页不丢失
- 支持跨标签页操作Cookie

## 安装方法

### 从Chrome应用商店安装
（未来可能会发布到Chrome应用商店）

### 从源代码安装

1. 克隆或下载本项目代码到本地
2. 打开Chrome浏览器，访问 `chrome://extensions/`
3. 开启右上角的 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择本项目的根目录
6. 扩展将被添加到Chrome浏览器中

## 使用说明

界面顶部为两列表单，右侧为图标功能按钮（悬浮可查看说明）：

| 区域 | 操作 |
|------|------|
| 当前页面URL | ⬇ 提取当前页面Cookie；🔗 加载当前标签URL |
| 目标URL | ⬆ 向目标URL注入Cookie |
| 一键复制的Cookie名称 | ⧉ 按名称提取并复制Token |
| Cookie集名称 | 💾 保存Cookie集；↺ 加载Cookie集 |
| Cookie数据 | `{}` 一键复制JSON数据 |

### 基本操作
1. 点击Chrome浏览器工具栏中的Cookie Maker图标打开扩展面板
2. 默认会显示当前标签页的URL
3. **提取Cookie**：点击「提取当前页面Cookie」图标，提取当前页面所有Cookie
4. **注入Cookie**：填写「目标URL」，点击「向目标URL注入Cookie」图标；若表格中有勾选，则只注入勾选项
5. **保存Cookie集**：输入名称后点击「保存Cookie集」
6. **加载Cookie集**：输入名称后点击「加载Cookie集」
7. **复制JSON**：点击「复制JSON数据」图标，将Cookie以格式化JSON写入剪贴板

### 表格视图
- Cookie以表格展示：名称、值、域名、路径、过期时间、安全、HttpOnly
- 表格默认勾选 `access_token` 和 `refresh_token`
- 点击「名称」「值」单元格可直接复制内容
- 表头复选框可全选/取消全选；注入时按勾选过滤

### 一键复制Token
1. 在「一键复制的Cookie名称」中填写Cookie名，多个用逗号分隔（默认 `access_token,refresh_token`）
2. 点击「一键提取复制Token」图标
3. 剪贴板得到如下格式内容：

```
access_token:eyJhbGciOiJIUzI1NiJ9...
refresh_token:efebe277cd5e478e84c073ec8f5eaa28
```

### 数据缓存功能
- 扩展会自动缓存Cookie数据到 `chrome.storage.local`
- 缓存功能在后台脚本(`background.js`)中实现，确保数据持久化
- 即使关闭或切换标签页后重新打开扩展，之前的数据也能被正确恢复
- 所有可能修改Cookie数据的操作（提取、加载、输入）都会自动触发缓存更新

### 已保存Cookie集管理
- 扩展面板下方会显示所有已保存的Cookie集列表
- 点击 ✓ 可直接加载对应Cookie集
- 点击 🗑 可移除不需要的Cookie集
- 点击 ↻ 刷新列表

## 权限说明

该扩展需要以下权限：

- `cookies`：用于读取和修改Cookie
- `activeTab`：用于获取当前活动标签页信息
- `storage`：用于在本地存储保存的Cookie集和缓存数据
- `scripting`：用于在页面中执行脚本
- `<all_urls>`：允许扩展操作所有网站的Cookie

## 注意事项

1. 请谨慎使用此扩展，不要向不信任的网站注入Cookie
2. 注入Cookie可能会导致您的账号安全风险，请确保您了解操作的后果
3. 扩展仅在本地存储Cookie数据，不会上传到任何服务器
4. 缓存数据存储在浏览器的本地存储中，清除浏览器数据可能会导致缓存丢失
5. 日常开发推荐使用「加载已解压的扩展程序」安装；自行打包的 `.crx` 可能被Chrome禁用（未上架应用商店）

## 开发指南

如果您想参与开发或修改此扩展，请按照以下步骤：

1. 克隆项目代码
2. 在项目目录下修改 `popup.html` / `popup.js` / `background.js`
3. 在 `chrome://extensions/` 中重新加载扩展进行测试

## 技术栈

- HTML5
- CSS3
- JavaScript
- Chrome Extension API (Manifest V3)
