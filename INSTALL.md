# 安装指南

## 修复 Electron 安装失败问题

如果遇到 `Electron failed to install correctly` 错误，按以下步骤操作：

### 步骤 1：关闭所有占用进程

```bash
# 关闭所有 Node.js 和 Electron 进程
taskkill /F /IM node.exe /T
taskkill /F /IM electron.exe /T

# 或者直接关闭所有终端窗口，然后重新打开
```

### 步骤 2：手动删除 node_modules

```bash
cd e:\Projects\avator_harbin_snow\veo-studio-electron

# 手动删除（在资源管理器中操作更可靠）
# 或使用命令行：
rmdir /s /q node_modules
del package-lock.json
```

**重要**: 如果删除失败，请：
1. 关闭 VS Code 和所有终端
2. 在资源管理器中手动删除 `node_modules` 文件夹
3. 如果还是删除不了，重启电脑

### 步骤 3：配置 Electron 镜像

创建 `.npmrc` 文件：

```bash
echo electron_mirror=https://npmmirror.com/mirrors/electron/ > .npmrc
echo electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/ >> .npmrc
```

或者手动创建 `.npmrc` 文件，内容如下：

```
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

### 步骤 4：重新安装依赖

```bash
# 清理 npm 缓存
npm cache clean --force

# 安装依赖
npm install

# 验证安装
node_modules\.bin\electron --version
```

如果仍然失败，尝试指定 Electron 版本：

```bash
npm install electron@27.3.11 --save-dev
```

## 快速启动指南

### 方式 1：分步启动（推荐用于调试）

**终端 1 - 启动前端开发服务器：**
```bash
npm run dev
```
等待提示 `Local: http://localhost:5173/`

**终端 2 - 构建并启动 Electron：**
```bash
npm run build:electron
set VITE_DEV_SERVER_URL=http://localhost:5173
node_modules\.bin\electron .
```

### 方式 2：一键启动

```bash
npm run electron:dev
```

注意：这个命令会自动启动 Vite 和 Electron，但如果遇到端口冲突可能会失败。

## 构建生产版本

```bash
# 完整构建（包含打包）
npm run build

# 仅构建不打包
npm run build:electron  # 构建 Electron 主进程
vite build              # 构建前端
```

构建产物：
- `dist/` - 前端构建输出
- `dist-electron/` - Electron 主进程构建输出
- `release/` - 打包后的安装程序

## 常见问题

### Q: npm install 很慢或失败

**方案 1：使用淘宝镜像**
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

**方案 2：使用代理**
```bash
npm config set proxy http://your-proxy:port
npm config set https-proxy http://your-proxy:port
npm install
```

### Q: 提示找不到 Python

某些依赖（如 better-sqlite3）需要编译，需要 Python 环境。

**解决方案：**
```bash
npm install --ignore-scripts
```

然后手动下载预编译的 better-sqlite3 二进制文件。

### Q: 启动 Electron 后白屏

**可能原因：**
1. Vite 开发服务器未启动
2. 端口号不匹配

**解决方案：**
1. 确保 Vite 运行在 http://localhost:5173
2. 检查 `VITE_DEV_SERVER_URL` 环境变量是否设置正确

### Q: 打包后的应用无法运行

**检查清单：**
1. `dist/` 和 `dist-electron/` 目录是否存在
2. 检查 `package.json` 中的 `main` 字段是否正确
3. 查看 `release/` 目录下的日志文件

## Node.js 版本要求

推荐使用 **Node.js 20.x LTS**

检查版本：
```bash
node -v
```

如果是 Node.js 22.x，建议降级到 20.x：
1. 卸载当前 Node.js
2. 下载安装 Node.js 20.x LTS：https://nodejs.org/

## 技术支持

如果以上方法都无法解决问题：
1. 删除整个 `veo-studio-electron` 文件夹
2. 重新从 Git 克隆或复制项目
3. 按照本文档重新安装
