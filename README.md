# Web性能分析插件

## 简介
完全复刻参考图的Web性能分析插件，使用Manifest V3标准，兼容Chrome/Edge浏览器。

## 功能特性
- ✅ 关键性能指标展示（8个核心指标）
- ✅ 瀑布流图表（14个阶段耗时统计）
- ✅ 资源分析概览（8个统计卡片）
- ✅ 多维度深度分析（12个图表）
- ✅ 慢资源排行（静态资源 + AJAX请求）
- ✅ 点击复制域名功能
- ✅ 模拟数据演示模式

## 文件结构
```
Web-PerformanceAnalysis-Plugin/
├── manifest.json           # Chrome扩展配置文件（Manifest V3）
├── popup.html              # 插件弹窗页面
├── popup.js               # 主逻辑脚本
├── styles.css             # 样式表
├── content-script.js        # Content Script（注入到网页）
└── lib/
    ├── chart.umd.js       # Chart.js库（v4.x）
    └── echarts.min.js     # ECharts库
```


#### 关键指标
- **首包（TTFB）**：服务器响应首字节的时间
- **首次渲染**：页面首次渲染的时间
- **首次可交互**：页面可交互的时间
- **DOM Ready**：DOM解析完成的时间
- **页面加载**：页面完全加载的时间
- **First Paint**：首次绘制的时间
- **First Contentful Paint**：首次内容绘制的时间
- **First Meaningful Paint**：首次有意义绘制的时间

性能状态：
- 🟢 绿色：优秀
- 🟡 橙色：一般
- 🔴 红色：较差

#### 瀑布流
使用ECharts渲染14个阶段的耗时(包含动态连线效果)
1. unLoad（页面卸载）
2. Redirect（重定向）
3. AppCache（应用缓存）
4. DNS（DNS解析）
5. TCP（TCP连接）
6. SSL（SSL握手）
7. TTFB（首字节时间）
8. 数据传输
9. 交互DOM（DOM交互）
10. 剩余DOM
11. DCL（DOM内容加载）
12. 资源加载
13. onLoad（页面加载）
14. 总耗时

#### 资源分析
- **域名总数**：涉及的不同域名数量
- **请求总数**：总请求数量
- **总耗时**：所有资源加载的总时间
- **平均耗时**：每个资源的平均加载时间
- **网络耗时**：每个资源的平均加载时间
- **压缩大小**：每个资源的压缩后大小
- **实际大小**：每个资源的实际传输大小
- **跨域无法统计请求**：由于跨域限制，无法获取某些资源的详细加载信息


#### 深度分析图表（12个）

使用Chart.js渲染饼图和柱状图
包含：请求数量域名分布、域名分布、各域名耗时、跨域分布、缓存命中率、文本压缩率、未压缩域名、Initiator分析、文件类型分析等


#### 慢资源列表
筛选规则：
- **慢静态资源**：非AJAX请求 + 加载时间 > 40ms
- **慢AJAX**：AJAX/fetch请求 + 加载时间 > 40ms

显示Top 5最慢的资源，包含：
- 资源地址（点击可复制域名）
- 请求类型
- 协议类型
- 加载时间（ms）
- 传输大小
- 压缩大小
- 实际大小

## 技术实现

### 数据采集
- **Performance API**：使用浏览器原生性能API
- **Navigation Timing API**：获取页面加载各阶段时间
- **Resource Timing API**：获取每个资源的加载详情
- **Paint Timing API**：获取绘制时间
- **LCP API**：获取最大内容绘制时间

### 可视化
- **Chart.js v4.x**：饼图、柱状图等基础图表
- **ECharts**：瀑布流等复杂图表
- **自定义Canvas绘制**：轻量级饼图实现

### 安全性
- 遵循 Manifest V3 规范
- 最小权限原则（仅必要的activeTab、scripting、storage）
- 无内联脚本，避免CSP违规
- 无外部数据传输，所有数据本地处理

