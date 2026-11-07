DeepSeek Harness 机甲驾驶舱启动插件首版。

- 许可确认、身份确认、渐进加载、欢迎主画面完整流程。
- 全身点阵鲸鱼、白色闪光、逐字加速艺术字、小鲸鱼消散为星空。
- 默认英文与声音开启，右上角支持中英与声音切换。
- 沿用社区自然女声优先策略，六句短播报和机械提示音。
- 删除重播入口；欢迎画面自动淡出到 Harness 工作区。
- Host bundle、客户端设置页、背景替换配置、启动失败自动放行。
- 背景、视频、字体随包携带；无 npm 运行时依赖。

下载下方 `.tgz`，完全退出桌面端后安装：

```bash
dsh plugin --profile desktop add ./dsh-cockpit-startup-1.0.0.tgz
```

Web profile 将 `desktop` 改为 `web`。已安装社区 `dsh-startup-screen` 时先停用它，避免覆盖层重叠。

已通过自动测试与浏览器完整流程验证。开发机未安装 Harness，尚未进行真实 Harness Desktop 安装实测。启动许可与默认密码为视觉交互，不替代宿主真实认证。
