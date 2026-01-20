# Veo Studio - Electron 版本

基于 Electron + React + TypeScript 的 AI 视频和图片生成工具。

## 环境要求

- **Node.js**: 18.x 或 20.x（推荐 20.x LTS）
- **npm**: 9.x 或更高
- **操作系统**: Windows 10/11

## 项目结构

```
veo-studio-electron/
├── src/                    # 前端 React 代码
│   ├── components/         # React 组件
│   ├── pages/              # 页面组件
│   └── lib/                # 工具函数和 API 封装
├── src-main/               # Electron 主进程代码
│   ├── main.ts             # 主进程入口
│   ├── preload.ts          # 预加载脚本
│   └── services/           # 后端服务（数据库、API、文件）
├── dist/                   # 前端构建输出
├── dist-electron/          # 主进程构建输出
└── release/                # 打包输出目录
```

## 安装步骤

### 1. 清理并重新安装依赖

```bash
cd e:\Projects\avator_harbin_snow\veo-studio-electron

# 删除旧的依赖和缓存
rmdir /s /q node_modules
del package-lock.json
npm cache clean --force

# 重新安装依赖
npm install
```

**注意：** 如果 Electron 下载失败，可以设置国内镜像：

```bash
# 方法1：使用 .npmrc 文件
echo electron_mirror=https://npmmirror.com/mirrors/electron/ > .npmrc
echo electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/ >> .npmrc

# 方法2：使用环境变量
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```

### 2. 验证 Electron 安装

创建测试文件 `test-electron.js`：

```javascript
const { app } = require('electron')
console.log('Electron version:', process.versions.electron)
console.log('Node version:', process.versions.node)
app.whenReady().then(() => {
  console.log('Electron is ready!')
  app.quit()
})
```

运行测试：

```bash
node_modules\.bin\electron test-electron.js
```

如果看到 "Electron is ready!" 说明安装成功。

### 3. 解决 Electron 模块加载问题（如果遇到）

如果遇到 `Cannot read properties of undefined (reading 'whenReady')` 错误：

**方案 A：降级 Node.js**
- 卸载当前 Node.js
- 安装 Node.js 20.x LTS 版本
- 重新运行步骤 1

**方案 B：降级 Electron**

```bash
npm uninstall electron
npm install electron@27.0.0 --save-dev
```

**方案 C：使用全局 Electron**

```bash
npm install -g electron
electron test-electron.js
```

## 开发运行

### 启动开发服务器

```bash
# 方式1：使用 Vite（只启动前端）
npm run dev

# 方式2：同时启动 Vite 和 Electron（推荐）
npm run electron:dev
```

访问 http://localhost:5173 可以在浏览器中预览前端（但 Electron API 不可用）。

### 手动启动 Electron

如果自动启动失败，可以手动分两步启动：

```bash
# 终端1：启动 Vite 开发服务器
npm run dev

# 终端2：等待 Vite 启动后，构建并运行 Electron
npm run build:electron
set VITE_DEV_SERVER_URL=http://localhost:5173
node_modules\.bin\electron .
```

## 构建打包

### 1. 构建前端和主进程

```bash
npm run build
```

这会执行：
1. 编译 Electron 主进程代码
2. 构建 React 前端
3. 使用 electron-builder 打包应用

### 2. 仅构建不打包

```bash
# 构建主进程
npm run build:electron

# 构建前端
vite build
```

### 3. 生成安装包

构建完成后，安装包位于 `release/` 目录：
- `Veo Studio Setup 1.0.0.exe` - NSIS 安装程序

## 配置说明

### API Key 设置

首次运行时需要设置 API Key：
1. 点击右上角 "设置 API Key" 按钮
2. 输入你的 `tu-zi.com` API Key
3. API Key 会保存在本地

### 数据存储

应用数据存储在：
- **Windows**: `C:\Users\{用户名}\AppData\Roaming\veo-studio\data\`
  - `database.db` - SQLite 数据库
  - `images/` - 生成的图片
  - `videos/` - 生成的视频

## 常见问题

### Q1: Electron 无法启动，提示 "app is undefined"

**原因**: Electron 模块加载失败

**解决方案**:
1. 检查 Node.js 版本是否为 18.x 或 20.x
2. 删除 `node_modules` 和 `package-lock.json`，重新安装
3. 尝试降级 Electron：`npm install electron@27.0.0 --save-dev`
4. 检查是否有全局 Electron 干扰：`npm list -g electron`

### Q2: 依赖安装很慢

**解决方案**: 使用国内镜像

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### Q3: 构建失败，提示找不到模块

**解决方案**:
```bash
npm install
npm run build:electron
```

### Q4: 打包后的应用无法启动

**原因**: 缺少必要的依赖或资源文件

**解决方案**:
1. 检查 `package.json` 中 `build.files` 配置
2. 确保 `dist` 和 `dist-electron` 目录存在
3. 重新构建：`npm run build`

### Q5: 图片/视频无法显示

**原因**: 文件协议问题

**解决方案**: 应用已配置 `local-file://` 协议，确保使用 `getStaticUrl()` 函数处理本地文件路径。

## 开发指南

### 添加新的 IPC 通道

1. 在 `src-main/services/ipc.ts` 中添加处理器
2. 在 `src-main/preload.ts` 中暴露接口
3. 在 `src/lib/api.ts` 中添加 API 方法

### 修改数据库结构

编辑 `src-main/services/database.ts` 中的 `initDatabase()` 函数。

### 自定义打包配置

编辑 `package.json` 中的 `build` 字段。

## 技术栈

- **前端**: React 18 + TypeScript + TailwindCSS + shadcn/ui
- **主进程**: Electron 28 + TypeScript
- **数据库**: better-sqlite3
- **构建**: Vite + electron-builder
- **状态管理**: React Hooks
- **路由**: React Router v6

## 许可

MIT License
