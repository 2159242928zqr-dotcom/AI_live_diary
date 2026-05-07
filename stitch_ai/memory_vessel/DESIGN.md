---
name: Memory Vessel
colors:
  surface: '#0c1324'
  surface-dim: '#0c1324'
  surface-bright: '#33394c'
  surface-container-lowest: '#070d1f'
  surface-container-low: '#151b2d'
  surface-container: '#191f31'
  surface-container-high: '#23293c'
  surface-container-highest: '#2e3447'
  on-surface: '#dce1fb'
  on-surface-variant: '#c6c6cd'
  inverse-surface: '#dce1fb'
  inverse-on-surface: '#2a3043'
  outline: '#909097'
  outline-variant: '#45464d'
  surface-tint: '#bec6e0'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  inverse-primary: '#565e74'
  secondary: '#cebdff'
  on-secondary: '#381385'
  secondary-container: '#4f319c'
  on-secondary-container: '#bea8ff'
  tertiary: '#f9bd22'
  on-tertiary: '#402d00'
  tertiary-container: '#211600'
  on-tertiary-container: '#a47a00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#e8ddff'
  secondary-fixed-dim: '#cebdff'
  on-secondary-fixed: '#21005e'
  on-secondary-fixed-variant: '#4f319c'
  tertiary-fixed: '#ffdf9f'
  tertiary-fixed-dim: '#f9bd22'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5c4300'
  background: '#0c1324'
  on-background: '#dce1fb'
  surface-variant: '#2e3447'
typography:
  display-lg:
    fontFamily: notoSerif
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
  header-title:
    fontFamily: notoSerif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-main:
    fontFamily: inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max-width: 860px
  gutter-md: 1.5rem
  margin-mobile: 1rem
  stack-gap: 2rem
---

## Brand & Style

此设计系统的核心理念是“情感容器”。它旨在为用户提供一个安全、私密且具有仪式感的空间，用于记录内心深处的独白。设计风格结合了**柔和的 3D 触感 (Tactile)** 与**玻璃拟态 (Glassmorphism)**，创造出一种仿佛置身于深夜宁静海洋或深邃星空的沉浸感。

界面不应是扁平的，而应通过光影表现出物质的体积感和包裹感。视觉传达应体现：
- **仪式感 (Ceremonial):** 录音和回顾过程应如同开启一个精致的饰品盒。
- **陪伴感 (Accompanied):** AI 不仅仅是工具，而是深夜里一盏温柔的明灯。
- **私密性 (Private):** 通过深色调和微妙的对比度，建立起心理上的安全边界。

## Colors

色彩方案采用深邃的“深夜”基调。**Deep Graphite (#020617)** 作为背景色，配合深蓝色的线性渐变，模拟无尽的夜空或深海。

- **Midnight Blue (#0F172A):** 用于主要的容器和卡片，建立深度感。
- **Soft Violet (#A78BFA):** 象征 AI 的智慧与律动，专用于语音波形、AI 对话气泡及关键交互引导。
- **Amber (#FBBF24):** 仅用于“特别瞬间”或珍贵记忆的点缀，如星级标记、纪念日提醒。
- **文字层级:** 使用 **Off-white (#F8FAFC)** 确保在暗色背景下的极致易读性，**Muted Slate (#64748B)** 处理辅助信息，减少视觉疲劳。

## Typography

为了平衡“日记”的文学气质与“AI”的科技属性，此系统采用了双字体策略。

标题部分使用 **Noto Serif (衬线体)**，赋予应用一种如实体笔记本般的精致感和永恒感。在中文环境下，建议搭配具有人文气息的宋体或明体。

正文及交互组件使用 **Inter (无衬线体)**，确保在移动端小屏幕上拥有极高的识别率和现代感。行间距应保持适度宽松，以营造从容、不迫的阅读节奏。

## Layout & Spacing

布局逻辑遵循“日记本”的中轴对称原则：

1. **桌面端 (Desktop):** 采用固定宽度的中央容器 (Centered Container)，两侧留白，模拟书页在桌面展开的视觉效果。
2. **移动端 (Mobile):** 采用全宽流体卡片布局，利用边缘安全距离确保操作舒适度。
3. **节奏感:** 使用以 8px 为基准的间距系统。组件之间保持较大的垂直间距 (Stack Gap)，为记忆的呼吸感留出余地。

## Elevation & Depth

此设计系统摒弃了传统的平面投影，转而使用“内发光”与“深阴影”结合的 3D 渲染技法。

- **卡片深度:** 卡片具有 1px 的半透明内描边 (Inner Border)，顶部边缘带有极细微的白色高光，底部则有深沉的扩散阴影。
- **发光特效:** AI 相关的交互组件（如录音按钮、波形图）拥有基于 **Soft Violet** 的外发光 (Glow)，模拟发光体在暗室中的漫反射。
- **层级:** 背景层 (#020617) 位于最底层；内容卡片 (#0F172A) 略微浮起；模态弹窗或浮动按钮具有最高层级，伴随更大幅度的模糊阴影。

## Shapes

形状语言温润、无锐角，体现出容器的包容性。

- **通用圆角 (rounded-md):** 8px，用于输入框和小型组件。
- **卡片圆角 (rounded-lg):** 16px，用于日记条目和主要功能块。
- **容器圆角 (rounded-xl):** 24px，用于大型模态框或底部导航栏。
- **圆形元素:** 日历日期标记和播放按钮应使用完美的圆形，象征循环与完整。

## Components

### 3D 记忆卡片 (Memory Cards)
卡片需具备微弱的渐变背景（从 #1E293B 到 #0F172A）。在悬停或选中状态下，内发光 (Inner Glow) 的亮度应平滑增强，创造出一种物体被“点亮”的物理感。

### 按钮 (Glow Buttons)
主要动作按钮（如“开始倾诉”）应使用 Soft Violet 填充，并带有同色的柔和光晕层。文字使用深色以确保对比。次要按钮采用幽灵按钮样式，仅保留微弱的描边。

### 语音波形 (Voice Waveforms)
波形应呈现为连续的、具有厚度的 3D 条状或平滑曲线。使用渐变色（Soft Violet 至更浅的紫），动态录音时波形应有律动的光点效果，模拟能量的流动。

### 日历组件 (Calendar Widget)
日历采用极简主义风格。日期数字浮动在背景上，当前日期或有记录的日期使用圆形标记。未选中的日期采用 Muted Slate，选中的日期使用 Amber 点亮，边缘辅以微小的发光。

### 输入字段 (Input Fields)
输入区域应呈现为向内凹陷的“槽位”视觉效果，通过深色的内阴影实现。这种“刻入”感强化了日记记录的永恒性。