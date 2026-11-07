# DeepSeek Cockpit Startup

DeepSeek Harness 的机甲驾驶舱启动插件。默认英文，支持中文切换，声音默认开启；进入控制台后继续使用同一段驾驶舱动态背景。

![DeepSeek Cockpit 欢迎画面](docs/cockpit-preview.png)

**访问许可确认 → 默认身份确认 → 渐进加载 → 确认进入 → DeepSeek Harness 欢迎主画面 → Harness 工作区。**

完整点阵鲸鱼渐显并闪白，驾驶舱逐层点亮；欢迎画面使用逐字加速艺术字、16 秒循环背景视频，鲸鱼投影及消散为星星的动画直接合成在视频里，随背景一起缩放和裁切。没有重播入口、普通登录输入框、音色选择或背景替换浮层。

## 安装

### 在 Harness 的“添加插件”中安装（推荐）

打开 Harness 的 **插件 → 添加插件**，在包名或地址输入框中，**只粘贴下面这一行地址**：

```text
https://github.com/wangyiyi2056/dsh-cockpit-startup/releases/download/v1.2.0/dsh-cockpit-startup-1.2.0.tgz
```

点击安装，完成后重新打开 Harness，即可播放启动画面。无需提前下载文件。

**这个输入框里不要填写 `dsh plugin --profile desktop add`。** 它是终端命令的前缀，一起粘贴会出现“无法识别这个包名或地址：not a package name the registry accepts”。复制时也不要带上反引号或 Markdown 链接格式。

### 在终端中通过 dsh 添加

如果使用终端，则运行下面的完整命令。先至少启动过一次 DeepSeek Harness 桌面端，让它初始化 `desktop` profile；完全退出桌面端后执行：

```bash
dsh plugin --profile desktop add https://github.com/wangyiyi2056/dsh-cockpit-startup/releases/download/v1.2.0/dsh-cockpit-startup-1.2.0.tgz
dsh plugin --profile desktop list
```

重新打开 Harness 即可。Web profile 使用：

```bash
dsh plugin --profile web add https://github.com/wangyiyi2056/dsh-cockpit-startup/releases/download/v1.2.0/dsh-cockpit-startup-1.2.0.tgz
```

Web 用户请在执行前停止正在运行的 `dsh web`，安装完成后重新启动。自定义 profile 将命令中的 `desktop` 或 `web` 换成实际使用的名称。

插件目前通过 GitHub Release 分发，请使用上面的完整地址添加。安装包已包含构建好的代码、背景、视频和字体。

| 使用位置 | 填写内容 |
| --- | --- |
| Harness“添加插件”输入框 | 仅填写 `https://…/dsh-cockpit-startup-1.2.0.tgz` 完整地址 |
| 系统终端 | 执行 `dsh plugin --profile desktop add <完整地址>` 完整命令 |

如果已安装社区 `dsh-startup-screen`，先在对应 profile 的插件管理中停用它，避免两个启动画面同时覆盖。

### 本地安装包添加

需要离线安装时，从 [Releases](https://github.com/wangyiyi2056/dsh-cockpit-startup/releases/latest) 下载 `dsh-cockpit-startup-1.2.0.tgz`，在文件所在目录执行：

```bash
dsh plugin --profile desktop add ./dsh-cockpit-startup-1.2.0.tgz
```

### 卸载

```bash
dsh plugin --profile desktop remove dsh-cockpit-startup
```

### 从旧版本更新

在插件管理中卸载旧版，再使用上方 **v1.2.0** 地址添加，完成后重启 Harness。v1.2.0 将欢迎页鲸鱼合成进背景视频，修复缩放错位和大屏尺寸过小。插件配置文件会保留：旧版默认的 11 秒加载自动调整为 9 秒，误填的本机海报路径自动恢复为内置视频。图形界面若提示已安装，也按此方式更新。

## 使用与配置

前两步各点击一次确认，默认身份自动核验，不需要输入密码。最后点击 `ENTER DEEPSEEK`，展示完整欢迎动画，默认停留 12 秒后淡出到工作区，驾驶舱视频继续作为控制台背景。欢迎画面按 Enter 会等待当前欢迎语结束后进入工作区；任意阶段按 Esc 可直接放行。

设置 → **DeepSeek Cockpit**：

| 配置 | 默认值 |
| --- | --- |
| 启用 | 开启 |
| 播放时机 | 每个浏览器会话一次，可改为每次打开 / 每天一次 |
| 界面语言 | English |
| 身份名称 | EXPLORER 01 / 探索者 01，支持自定义 |
| 语音与音效 | 开启 |
| 加载时长 | 9 秒，范围 8–16 秒 |
| 欢迎画面停留 | 12 秒，范围 10–30 秒 |
| 控制台动态背景 | 开启，启动结束后继续播放同一段视频 |
| 自定义图片 / 视频 | 留空使用内置素材 |

配置保存在 `$DSH_HOME/dsh-cockpit.json`，默认 `~/.dsh/dsh-cockpit.json`。无 HTTP Host 的客户端回退模式使用浏览器本地配置。启动画面右上角仅保留语言和声音切换，这两个偏好在当前浏览器保存；设置页保存时更新偏好。

后续替换背景：在设置页填写 HTTPS 视频或图片地址，也可以使用宿主已提供的同源网页 `/路径`。不能直接填写电脑上的 `/Users/...` 或 `C:\\Users\\...` 文件路径。留空使用内置视频；只填写有效图片网址时显示静态背景，填写视频时优先播放该视频。许可页点阵和艺术字由界面绘制；欢迎页的鲸鱼与星空属于内置视频内容，替换视频后会一起被替换。也可以替换仓库 `assets/` 中同名文件，再重新打包。

语音沿用社区版自然英语女声优先策略，语速 `0.88`、音调 `0.85`、开口留白 `240ms`。许可页播报 `Access permission required.`，欢迎语完整播报 `Welcome back, DeepSeek Harness.`。桌面端尝试开场直接播报；若环境限制自动语音，则在第一次正常点击或按键时补播，并等待许可播报结束后继续。加载阶段补充合成机械提示音，无额外启用提示。具体声线由系统提供的 Web Speech 音色决定。

## 从源码构建与预览

Node.js **20+**，无第三方 npm 依赖。

```bash
git clone https://github.com/wangyiyi2056/dsh-cockpit-startup.git
cd dsh-cockpit-startup
npm test
npm run pack:release
npm run preview
```

预览地址 `http://127.0.0.1:4173/`；`/client-preview` 演示客户端 ModuleLoader 回退挂载，`/mobile-preview` 预览 375px 窄屏，`/frame` 单独预览视觉。预览页面中的工作区是占位内容。

安装包输出到 `releases/`。`npm pack` 自动构建，图片、16 秒静音视频和艺术字体都嵌入包中，默认视觉不依赖 CDN。系统在线语音是否联网由浏览器与操作系统决定。

多尺寸预览：打开 `/layout-preview`，切换普通屏、4K、超宽屏和手机，检查鲸鱼、消散、星空三个阶段。这个开发入口不影响安装后的正常确认流程。

重新制作视频（普通安装和构建不需要）：

```bash
python3 -m pip install numpy Pillow
npm run render:video
npm run build
```

需要安装 FFmpeg / FFprobe。原始生成视频保存在 `assets/cockpit-ambient-source.mp4`，合成脚本为 `scripts/render_whale_video.py`，位置、尺寸和时间轴记录在 `docs/video-composition.json`。输出为 1344×768 / 24fps / H.264 静音 MP4，海报取自鲸鱼停留阶段。调整脚本参数后重新渲染即可。

`docs/ci-example.yml` 提供 Node 20 / 22 / 24 的 GitHub Actions 检查示例。当前上传凭据没有 `workflow` 权限，因此仓库未启用自动工作流；需要时可在 GitHub 网页端将它放到 `.github/workflows/test.yml`。

```text
src/host.js       Host：tapIndex、路由、配置持久化、连接信任检查
src/client.js     ModuleLoader 客户端：设置页、回退挂载
src/runtime.js    启动覆盖层、播放频率、焦点与卸载管理
src/scene/        已定稿画面、点阵鲸鱼、星空、英文短播报
assets/          背景、视频、标识与离线艺术字体
scripts/         构建、预览、打包
test/            Host / 客户端 / 生命周期 / 语音测试
```

## 兼容与验证范围

Host 导出 `name / inject / apply`，通过 `cordis.patch.yml` 安装；客户端使用 `window.__ModuleLoader__.load` 与 `settings.section`，参考 [社区插件](https://github.com/QIFANAI/dsh-startup-screen)。未复制其整套视觉代码。

v1.2.0 通过 19 项自动测试，在 1920×1080、3840×2160、3440×1440 和 375px 窄屏检查了欢迎页视频裁切。此前 v1.1.0 已在 **macOS / Harness Desktop 0.2.1-rc.5** 完成安装和重启，控制台背景由用户确认可用。浏览器中验证了完整欢迎语的播报开始与结束、欢迎页视频播放、覆盖层释放、会话去重和独立客户端挂载。Windows、Linux 及其他宿主版本仍需实际安装确认。

权限与密码画面是启动仪式，不执行真实身份认证，也不修改 Harness 的权限、登录状态或安全设置。脚本启动失败时自动移除覆盖层；插件卸载会恢复工作区的焦点、滚动及可交互状态。

## 致谢与许可

代码 MIT。社区语音选择策略与接入方式参考沈宏宏及社区贡献者的 `dsh-startup-screen`，保留原版权声明。驾驶舱图片与背景视频为本项目生成素材；Chakra Petch 字体遵循 SIL OFL。未打包电影原声或商业音乐。详见 [第三方说明](THIRD-PARTY-NOTICES.md)。

这是独立社区插件，与 DeepSeek 官方无隶属关系；DeepSeek 标识与商标归原权利方所有。
