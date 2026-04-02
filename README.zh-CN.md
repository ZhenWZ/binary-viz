# Binary Data Visualizer — 二进制数据可视化工具

[English](README.md)

一款基于浏览器的工具，用于检查、解码和比较来自 PyTorch、NumPy、Safetensors 及原始二进制文件的张量数据。使用 React、Vite 和 Tailwind CSS 构建，所有文件解析和解码均在浏览器端完成，无需服务器端处理 — 完全通过 JavaScript `ArrayBuffer` API 实现。

---

## 功能特性

### 解码模式（Decode Mode）

加载单个二进制文件并查看其解码后的数值。工具会尽可能**自动检测**文件格式和数据类型，并在检测结果旁显示置信度标识。你可以随时手动覆盖检测设置。

解码完成后，界面将展示统计面板（最小值、最大值、均值、标准差、中位数）、数值分布直方图，以及支持分页的数据表格（可选显示十六进制字节）。

### 比较模式（Compare Mode）

并排比较两个数据源，逐元素差异高亮显示。每一侧独立支持两种数据源类型：

| 数据源类型 | 说明 |
|---|---|
| **二进制文件** | 任意支持的二进制文件（.bin, .pt, .ptx, .npy, .safetensors, .raw） |
| **文本** | 文本文件或粘贴的数值字符串（例如 `tensor([1.0, 2.0, 3.0])`） |

因此可以进行二进制对二进制、二进制对文本、或文本对文本的比较。比较视图包含差异摘要条、匹配/差异计数及百分比、可视化差异图，以及双面板同步悬停高亮。可配置的**容差**参数支持浮点数的近似匹配。

比较模式的额外功能：

- **同步滚动** — 保持两个数据表滚动位置一致。通过"Sync scroll"开关切换。
- **独立数据类型选择** — 使用不同的数据类型解码每个数据源。启用"Independent dtypes"开关即可分别选择数据类型。
- **跳转到位比较** — 点击比较表格中的任意单元格，可在位比较模式中打开对应的值进行逐位检查。

### 位比较模式（Bit Compare Mode）

逐位比较 2–8 个数值，精确可视化哪些位不同。适用于调试浮点精度问题、验证量化结果或理解编码差异。

- **双输入模式** — 支持十六进制字节或十进制数值输入。
- **位字段标注** — 每个位根据所选数据类型用颜色标注其含义（符号位、指数位、尾数位）。
- **HiFloat8 动态字段** — 对于 HiFloat8 值，字段边界（Dot、指数、尾数）按每个值动态计算，因为宽度随数据范围变化。
- **差异高亮** — 各条目间不同的位以红色高亮显示。
- **汉明距离** — 显示每对条目之间不同的位数。
- **从比较模式跳转** — 在比较模式中点击单元格，可预填充位比较模式的对应数值。

### 支持的文件格式

| 格式 | 扩展名 | 自动检测 | 说明 |
|---|---|---|---|
| NumPy | `.npy` | 高置信度 | 读取 `.npy` 头部提取数据类型、形状、字节序和数据偏移 |
| PyTorch | `.pt`, `.ptx`, `.pth`, `.bin` | 高置信度（含 `.pkl`） | 解析 ZIP 归档结构定位张量数据条目 |
| Safetensors | `.safetensors` | 高置信度 | 读取 JSON 头部提取张量元数据和数据偏移 |
| 原始二进制 | `.bin`, `.raw`, 任意 | 低置信度（启发式） | 根据文件扩展名和大小整除性猜测数据类型 |

对于包含多个张量的 PyTorch 和 Safetensors 文件，提供**张量选择器**下拉菜单供选择要检查的张量。

### 支持的数据类型

| 类别 | 类型 |
|---|---|
| FP8 | `float8_e4m3`（OCP E4M3FN）, `float8_e5m2`（OCP E5M2）, `float8_e8m0`（MX 缩放格式）, `hifloat8`（华为 HiF8，测试版） |
| 浮点数 | `float16`（IEEE 754）, `bfloat16`（Brain float）, `float32`, `float64` |
| 有符号整数 | `int8`, `int16`, `int32`, `int64` |
| 无符号整数 | `uint8`, `uint16`, `uint32`, `uint64` |
| 其他 | `bool` |

> **HiFloat8** 是华为为昇腾 NPU 设计的锥形精度 8 位浮点格式（arXiv:2409.16626）。它使用可变宽度字段 — 前缀编码的 Dot 字段决定指数和尾数字段的宽度，为小数值提供更高精度，为大数值提供更宽范围。该数据类型标记为**测试版**。

### 文本解析

文本解析器支持 PyTorch 和 NumPy 常见的张量打印格式，包括：

- `tensor([1.0, 2.0, 3.0, 4.0])` — PyTorch tensor repr
- `array([1.0, 2.0, 3.0])` — NumPy array repr
- `1.0 2.0 3.0 4.0` — 空格分隔值
- `1.0, 2.0, 3.0` — 逗号分隔值
- 特殊值：`NaN`, `inf`, `-inf`, `true`, `false`

### 会话历史

应用在浏览器的 localStorage 中记录解码和比较会话的日志。点击工具栏的时钟图标打开历史面板，可以：

- 查看最近的会话记录，包含时间戳、文件名、数据类型和元素数量。
- 从历史条目快速跳转回解码或比较模式。
- 随时清除历史记录。

### 模式状态缓存

在解码、比较和位比较模式之间切换时，每个模式的状态都会被保留。你加载的文件、解码结果和显示设置在切换标签页后仍然保持不变。

---

## 环境要求

- **Node.js** 18 或更高版本
- **pnpm** 10 或更高版本（项目使用 pnpm 作为包管理器）

如果尚未安装 pnpm，可以通过 Node.js corepack 启用：

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/ZhenWZ/binary-viz.git
cd binary-viz
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动开发服务器

```bash
pnpm dev
```

应用将在 `http://localhost:3000` 上可用。Vite 开发服务器支持热模块替换，任何代码更改都会立即反映在浏览器中。

### 4. 运行测试

```bash
pnpm test
```

运行 Vitest 单元测试套件，覆盖二进制解码、位操作工具函数和 HiFloat8 正确性验证。

### 5. 构建生产版本

```bash
pnpm build
```

此命令运行 `vite build` 在 `dist/public/` 目录生成优化后的静态包，随后通过 esbuild 打包用于提供静态文件的精简 Express 服务器。

### 6. 运行生产版本

```bash
pnpm start
```

在端口 3000（或 `PORT` 环境变量指定的端口）启动 Express 服务器，提供构建好的静态文件并支持客户端路由。

---

## 使用指南

### 解码二进制文件

1. 打开应用，确保在 **Decode** 标签页。
2. 将二进制文件拖放到放置区域，或点击浏览。
3. 工具将尝试自动检测文件格式和数据类型。查看**格式标识**（如 `numpy`、`pytorch`、`safetensors`、`raw`）和**自动检测**指示器。
4. 如果自动检测不正确，使用 **Data Type** 和 **Byte Order** 下拉菜单手动覆盖。
5. 对于多张量文件（PyTorch `.pt` 或 Safetensors），从 **Tensor** 下拉菜单中选择要检查的张量。
6. 根据需要调整显示设置：**Columns** 控制表格宽度，**Precision** 设置小数位数，**Show Hex** 开关显示每个解码数值下方的原始字节值。
7. 使用数据表格头部的搜索框跳转到特定元素索引。

### 比较两个数据源

1. 切换到 **Compare** 标签页。
2. 为每一侧（Source A 和 Source B）使用面板头部的 **Binary** / **Text** 切换选择数据源类型。
3. 加载数据：
   - **Binary**：拖放或浏览文件。
   - **Text**：拖放文本文件，或直接在文本区域粘贴数值。
4. 两侧都有数据后，比较结果自动显示：包含元素数量、差异/匹配计数及百分比的摘要行，以及可视化差异图。
5. 设置 **Tolerance** 值进行浮点数近似匹配（例如 `0.001` 忽略小于该阈值的差异）。
6. 启用 **Sync scroll** 保持两个面板滚动位置同步。
7. 启用 **Independent dtypes** 为每个数据源使用不同的数据类型进行解码。
8. 点击数据表格中的任意单元格，在 **Bit Compare** 模式中打开对应的值。

### 位比较

1. 切换到 **Bit Compare** 标签页，或在比较模式中点击单元格。
2. 选择数据类型和字节序。
3. 为每个条目输入十六进制或十进制值（支持 2–8 个条目）。
4. 位网格显示每个值的二进制表示，字段用颜色标注（符号位、指数位、尾数位）。
5. 不同的位以红色高亮显示；下方显示各对条目之间的汉明距离。

---

## 项目结构

```
binary-viz/
├── client/
│   ├── index.html                  # HTML 入口文件
│   ├── src/
│   │   ├── App.tsx                 # 根组件，包含路由和主题
│   │   ├── main.tsx                # React 入口
│   │   ├── index.css               # 全局样式和 Tailwind 主题
│   │   ├── lib/
│   │   │   ├── binaryDecoder.ts    # 核心解码、格式检测、比较逻辑
│   │   │   ├── binaryDecoder.test.ts # 解码和比较测试（122 个测试）
│   │   │   ├── bitUtils.ts         # 位操作、字段标注、十六进制/字节转换
│   │   │   ├── bitUtils.test.ts    # 位工具测试
│   │   │   ├── history.ts          # 会话历史（localStorage）
│   │   │   └── utils.ts            # 通用工具函数
│   │   ├── pages/
│   │   │   ├── Home.tsx            # 主布局，标签页导航和模式状态缓存
│   │   │   ├── DecodeMode.tsx      # 单文件解码视图
│   │   │   ├── CompareMode.tsx     # 并排比较，支持同步滚动
│   │   │   └── BitCompareMode.tsx  # 位级数值比较
│   │   └── components/
│   │       ├── BitGrid.tsx         # 位模式渲染器，支持字段着色
│   │       ├── FileDropZone.tsx    # 拖放文件上传
│   │       ├── DTypeSelector.tsx   # 数据类型和显示控件
│   │       ├── DataTable.tsx       # 分页数据网格，支持差异高亮
│   │       ├── StatsPanel.tsx      # 统计摘要显示
│   │       ├── DataDistribution.tsx # 数值分布直方图
│   │       ├── DiffSummaryBar.tsx  # 可视化差异密度图
│   │       └── HistoryPanel.tsx    # 会话历史弹出面板
│   └── public/                     # 静态资源（favicon, robots.txt）
├── server/
│   └── index.ts                    # 精简 Express 生产服务器
├── package.json
└── vite.config.ts
```

整个解码引擎位于 `client/src/lib/binaryDecoder.ts`。它负责 NumPy `.npy` 头部解析、PyTorch ZIP 归档遍历、Safetensors JSON 头部读取，以及所有数据类型转换，包括四种 FP8 变体（E4M3、E5M2、E8M0、HiFloat8）。未使用任何外部二进制解析库 — 全部通过 `DataView`、`Uint8Array` 和手动位操作实现。

---

## 可用脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动 Vite 开发服务器，端口 3000，支持 HMR |
| `pnpm build` | 构建生产版本（客户端 + 服务器） |
| `pnpm start` | 通过 Express 提供生产版本 |
| `pnpm preview` | 使用 Vite 内置服务器预览生产版本 |
| `pnpm test` | 运行 Vitest 单元测试套件 |
| `pnpm check` | 运行 TypeScript 类型检查 |
| `pnpm format` | 使用 Prettier 格式化所有文件 |

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | React 19 |
| 构建工具 | Vite 7 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 动画 | Framer Motion |
| 路由 | Wouter |
| 语言 | TypeScript 5.6 |
| 测试 | Vitest |
| 生产服务器 | Express 4 |
| 包管理器 | pnpm 10 |

---

## 许可证

MIT
