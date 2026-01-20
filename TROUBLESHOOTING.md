# Electron 启动问题排查指南

## 当前问题

运行 Electron 时遇到错误：
```
TypeError: Cannot read properties of undefined (reading 'whenReady')
```

## 问题原因

在编译后的 CommonJS 代码中，`require('electron')` 没有正确返回 Electron 模块对象。这可能与以下因素有关：

1. **Node.js 版本问题**：Node.js 22.15.1 与 Electron 27 可能存在兼容性问题
2. **模块解析问题**：Electron 在不同环境下的模块导出方式不同
3. **编译配置问题**：TypeScript/打包工具的配置可能影响模块解析

## 解决方案

### 方案 1：降级 Node.js（强烈推荐）

**Electron 27 官方推荐使用 Node.js 18.x 或 20.x**

1. 卸载 Node.js 22.15.1
2. 安装 Node.js 20.18.1 LTS：https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi
3. 重新安装项目依赖：
   ```bash
   cd e:\Projects\avator_harbin_snow\veo-studio-electron
   rmdir /s /q node_modules
   del package-lock.json
   npm install
   npm run dev
   ```

### 方案 2：使用 Electron 26

如果无法降级 Node.js，尝试使用 Electron 26：

```bash
npm uninstall electron
npm install electron@26.6.10 --save-dev
npm run postinstall
npm run dev
```

### 方案 3：使用预编译的 Electron

```bash
npm uninstall electron electron-rebuild
npm install -g electron@27.3.11
npm install

# 启动时使用全局 Electron
electron .
```

### 方案 4：使用 Electron Forge（推荐用于新项目）

如果以上方案都失败，考虑使用 Electron Forge 重新初始化项目：

```bash
npm install -g @electron-forge/cli
cd ..
electron-forge init veo-studio-forge --template=vite-typescript
# 然后将现有代码迁移到新项目
```

## 验证步骤

### 1. 验证 Node.js 版本

```bash
node -v
```

应该显示 `v18.x.x` 或 `v20.x.x`

### 2. 验证 Electron 安装

```bash
node_modules\.bin\electron --version
```

应该显示版本号，如 `v27.3.11`

### 3. 测试 Electron 模块加载

创建测试文件 `test.js`：
```javascript
const { app } = require('electron')
console.log('Electron app:', app)
if (app) {
  console.log('Success!')
  app.quit()
} else {
  console.error('Failed: app is undefined')
}
```

运行：
```bash
node_modules\.bin\electron test.js
```

应该看到 "Success!"

## 当前项目状态

✅ **已完成**：
- Electron 项目结构创建
- 主进程服务实现（数据库、API、文件管理）
- IPC 通信层和预加载脚本
- 前端代码迁移和类型修复
- 前端开发服务器正常运行（http://localhost:5173）
- better-sqlite3 已 rebuild

❌ **待解决**：
- Electron 主进程无法启动
- 模块加载问题需要环境调整

## 临时解决方案：继续使用 Tauri

如果 Electron 问题持续无法解决，可以继续使用原有的 Tauri 版本：

```bash
cd e:\Projects\avator_harbin_snow\frontend
npm run tauri dev
```

## 获取帮助

如果问题仍然存在：

1. 检查 Node.js 版本：`node -v`
2. 检查 npm 版本：`npm -v`
3. 检查系统环境变量
4. 尝试在新的命令行窗口（以管理员身份）运行
5. 重启计算机后重试

## 参考资料

- Electron 官方文档：https://www.electronjs.org/docs/latest/
- Electron + Vite：https://electron-vite.org/
- Node.js 兼容性：https://www.electronjs.org/docs/latest/tutorial/support#platform-support
