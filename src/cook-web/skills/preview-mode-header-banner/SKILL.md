# 预览态头部提示条

当 `ai-shifu/src/cook-web/src/app/c/[[...id]]` 学习页需要根据 `?preview=true` 增加顶部提示时，优先抽成可复用组件，并同时覆盖桌面端 `ChatUi` 与移动端 `ChatMobileHeader`。

优先复用 `module.preview` 国际化命名空间，避免为同一类预览语义新增分散的翻译模块。

如果桌面端顶部区域是绝对定位 header，需要同步调整内容区 `padding-top` 与设置面板的 `margin-top`，避免提示条遮挡正文。
