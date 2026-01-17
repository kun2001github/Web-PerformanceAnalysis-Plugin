// Web性能分析插件 - 完全基于 Performance API

const THRESHOLDS = {
  ttfb: { good: 200, medium: 600 },
  fcp: { good: 1800, medium: 3000 },
  lcp: { good: 2500, medium: 4000 }
};

const SLOW_THRESHOLD = 40;

// 全局域名数据存储
let globalDomainData = {
  domains: [],
  domainCounts: {},
  totalRequests: 0,
  domainDetails: {},
  resources: []
};

// 分页状态
let domainPagination = {
  currentPage: 1,
  pageSize: 10,
  totalDomains: 0,
  totalPages: 1
};

function getMetricStatus(value, metric) {
  if (!value || value < 0) return 'medium';
  const t = THRESHOLDS[metric];
  if (!t) return 'medium';
  return value <= t.good ? 'good' : value <= t.medium ? 'medium' : 'bad';
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function extractDomain(url) {
  if (!url) return 'unknown';
  try { return new URL(url).hostname; } catch { return url; }
}

function getResourceType(r) {
  const url = r.name.toLowerCase();
  const type = r.initiatorType;
  if (url.includes('.js') || type === 'script') return 'js';
  if (url.includes('.css') || type === 'style') return 'css';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)/)) return 'image';
  if (url.match(/\.(woff|woff2|ttf|eot)/)) return 'font';
  if (type === 'xmlhttprequest' || type === 'fetch') return 'xhr';
  if (url.includes('.html')) return 'html';
  if (url.includes('.json')) return 'json';
  return type || 'other';
}

function isAjaxRequest(r) {
  const t = r.initiatorType;
  return t === 'xmlhttprequest' || t === 'fetch';
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小（如：1.5 MB）
 */
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 从URL提取域名
 * @param {string} url - 完整URL
 * @returns {string} 域名
 */
function extractDomain(url) {
  if (!url) return 'unknown';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url;
  }
}

/**
 * 获取资源类型
 * @param {PerformanceResourceTiming} resource - 资源对象
 * @returns {string} 资源类型（js, css, image等）
 */
function getResourceType(resource) {
  const url = resource.name.toLowerCase();
  const initiatorType = resource.initiatorType;
  
  if (url.includes('.js') || initiatorType === 'script') return 'js';
  if (url.includes('.css') || initiatorType === 'style') return 'css';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)/)) return 'image';
  if (url.includes('.font') || url.match(/\.(woff|woff2|ttf|eot)/)) return 'font';
  if (initiatorType === 'xmlhttprequest' || initiatorType === 'fetch') return 'xhr';
  if (url.includes('.html')) return 'html';
  if (url.includes('.json')) return 'json';
  
  return initiatorType || 'other';
}

/**
 * 判断是否为AJAX请求
 * @param {PerformanceResourceTiming} resource - 资源对象
 * @returns {boolean} 是否为AJAX请求
 */
function isAjaxRequest(resource) {
  const type = resource.initiatorType;
  return type === 'xmlhttprequest' || type === 'fetch';
}

/**
 * 验证资源数据的准确性，过滤无效数据
 * @param {Array} resources - 资源数组
 * @returns {Array} 验证后的资源数组
 */
function validateResources(resources) {
  if (!Array.isArray(resources)) return [];
  
  return resources.filter(r => {
    // 验证必需字段
    if (!r || typeof r !== 'object') return false;
    if (!r.name || typeof r.name !== 'string') return false;
    
    // 验证数值类型
    if (typeof r.duration !== 'number' || r.duration < 0) return false;
    if (typeof r.transferSize !== 'number' || r.transferSize < 0) return false;
    if (typeof r.decodedBodySize !== 'number' || r.decodedBodySize < 0) return false;
    if (typeof r.startTime !== 'number' || r.startTime < 0) return false;
    
    // 验证域名
    if (!r.domain || typeof r.domain !== 'string') return false;
    
    // 验证资源类型
    if (!r.type || typeof r.type !== 'string') return false;
    
    return true;
  });
}

/**
 * 验证跨域请求数据
 * @param {Array} crossOriginRequests - 跨域请求数组
 * @returns {Array} 验证后的跨域请求数组
 */
function validateCrossOriginRequests(crossOriginRequests) {
  if (!Array.isArray(crossOriginRequests)) return [];
  
  return crossOriginRequests.filter(item => {
    if (!item || typeof item !== 'object') return false;
    if (!item.domain || typeof item.domain !== 'string') return false;
    if (typeof item.count !== 'number' || item.count < 0) return false;
    // types 和 initiatorTypes 是可选字段
    return true;
  });
}

function rand(min, max) { return Math.floor(Math.random() * (max - min)) + min; }

function generateMockMetrics() {
  const ttfb = rand(50, 350);
  const firstRender = rand(500, 1500);
  const firstInteractive = firstRender + rand(200, 800);
  const domReady = firstInteractive + rand(100, 500);
  const pageLoad = domReady + rand(300, 1000);
  
  return {
    ttfb,
    firstRender,
    firstInteractive,
    domReady,
    pageLoad,
    firstPaint: firstRender,
    fcp: firstRender,
    fmp: firstRender + rand(200, 600)
  };
}

function generateMockWaterfallData() {
  const stages = [
    { name: 'unLoad', color: '#ccc', formula: 'unloadEventEnd - unloadEventStart' },
    { name: 'Redirect', color: '#ccc', formula: 'redirectEnd - redirectStart' },
    { name: 'AppCache', color: '#FBE192', formula: 'domainLookupStart - fetchStart' },
    { name: 'DNS', color: '#9561F9', formula: 'domainLookupEnd - domainLookupStart' },
    { name: 'TCP', color: '#2ACCA9', formula: 'connectEnd - connectStart' },
    { name: 'SSL', color: '#FBAA6E', formula: 'connectEnd - secureConnectionStart', parallel: true },
    { name: 'TTFB', color: '#FACC55', formula: 'responseStart - requestStart' },
    { name: '数据传输', color: '#F59363', formula: 'responseEnd - responseStart' },
    { name: '交互DOM', color: '#EF5E79', formula: 'domContentLoadedEventStart - responseEnd' },
    { name: '剩余DOM', color: '#ccc', formula: 'domInteractive - domLoading' },
    { name: 'DCL', color: '#9F92D6', formula: 'domContentLoadedEventEnd - domContentLoadedEventStart' },
    { name: '资源加载', color: '#42CE68', formula: 'loadEventStart - domContentLoadedEnd' },
    { name: 'onLoad', color: '#6AA7F3', formula: 'loadEventEnd - loadEventStart' },
    { name: '总耗时', color: '#DCE0E5', formula: 'Total' }
  ];
  
  return stages.map(s => ({ ...s, value: rand(0, 300) }));
}

function generateMockResources() {
  const domains = ['cdn.example.com', 'api.example.com', 'static.example.com', 'analytics.example.com'];
  const types = ['js', 'css', 'image', 'font', 'xhr', 'html'];
  const initiators = ['script', 'style', 'img', 'link', 'xmlhttprequest', 'fetch'];
  
  return Array.from({ length: 50 }, (_, i) => ({
    name: `https://${domains[rand(0, domains.length)]}/resource-${i}.${types[rand(0, types.length)]}`,
    duration: rand(20, 520),
    transferSize: rand(1000, 101000),
    encodedBodySize: rand(500, 50500),
    decodedBodySize: rand(2000, 202000),
    startTime: rand(0, 1000),
    domain: domains[rand(0, domains.length)],
    type: types[rand(0, types.length)],
    initiatorType: initiators[rand(0, initiators.length)]
  }));
}

function generateMockCrossOriginRequests() {
  return ['cdn1.example.com', 'api2.example.com', 'ads.example.com'].map(d => ({ domain: d, count: rand(1, 11) }));
}

function getSlowResources(resources, isAjax) {
  return resources
    .filter(r => isAjax ? isAjaxRequest(r) : !isAjaxRequest(r))
    .filter(r => r.duration > SLOW_THRESHOLD)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);
}

function collectMetrics(navigation) {
  const metrics = {
    ttfb: 0, firstRender: 0, firstInteractive: 0,
    domReady: 0, pageLoad: 0, firstPaint: 0, fcp: 0, fmp: 0
  };
  
  if (navigation) {
    metrics.ttfb = navigation.responseStart - navigation.domainLookupStart;
    metrics.firstRender = navigation.responseEnd - navigation.fetchStart;
    metrics.firstInteractive = navigation.domInteractive - navigation.fetchStart;
    metrics.domReady = navigation.domContentLoadedEventEnd - navigation.fetchStart;
    metrics.pageLoad = navigation.loadEventStart - navigation.fetchStart;
    
    metrics.firstPaint = metrics.firstRender;
    metrics.fcp = metrics.firstRender;
    metrics.fmp = metrics.firstRender;
  }
  
  const paintEntries = performance.getEntries().filter(e => e.entryType === 'paint');
  paintEntries.forEach(e => {
    if (e.name === 'first-paint' && e.startTime > 0) {
      metrics.firstPaint = Math.round(e.startTime);
    }
    if (e.name === 'first-contentful-paint' && e.startTime > 0) {
      metrics.fcp = Math.round(e.startTime);
    }
  });
  
  const lcpEntries = performance.getEntries().filter(e => e.entryType === 'largest-contentful-paint');
  if (lcpEntries.length > 0) {
    const lastLcp = lcpEntries[lcpEntries.length - 1];
    metrics.fmp = Math.round(lastLcp.startTime || lastLcp.renderTime);
  }
  
  return metrics;
}

function collectWaterfallData(navigation) {
  if (!navigation) return generateMockWaterfallData();
  
  const stages = [
    { name: 'unLoad', color: '#ccc', f: () => Math.max(0, navigation.unloadEventEnd - navigation.unloadEventStart) },
    { name: 'Redirect', color: '#ccc', f: () => Math.max(0, navigation.redirectEnd - navigation.redirectStart) },
    { name: 'AppCache', color: '#FBE192', f: () => Math.max(0, navigation.domainLookupStart - navigation.fetchStart) },
    { name: 'DNS', color: '#9561F9', f: () => Math.max(0, navigation.domainLookupEnd - navigation.domainLookupStart) },
    { name: 'TCP', color: '#2ACCA9', f: () => Math.max(0, navigation.connectEnd - navigation.connectStart) },
    { name: 'SSL', color: '#FBAA6E', f: () => Math.max(0, navigation.connectEnd - navigation.secureConnectionStart), parallel: true },
    { name: 'TTFB', color: '#FACC55', f: () => Math.max(0, navigation.responseStart - navigation.requestStart) },
    { name: '数据传输', color: '#F59363', f: () => Math.max(0, navigation.responseEnd - navigation.responseStart) },
    { name: '交互DOM', color: '#EF5E79', f: () => Math.max(0, navigation.domContentLoadedEventStart - navigation.responseEnd) },
    { name: '剩余DOM', color: '#ccc', f: () => Math.max(0, navigation.domInteractive - navigation.domLoading) },
    { name: 'DCL', color: '#9F92D6', f: () => Math.max(0, navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart) },
    { name: '资源加载', color: '#42CE68', f: () => Math.max(0, navigation.loadEventStart - navigation.domContentLoadedEventEnd) },
    { name: 'onLoad', color: '#6AA7F3', f: () => Math.max(0, navigation.loadEventEnd - navigation.loadEventStart) },
    { name: '总耗时', color: '#DCE0E5', f: () => navigation.loadEventEnd - navigation.fetchStart }
  ];
  
  const formulas = [
    'unloadEventEnd - unloadEventStart',
    'redirectEnd - redirectStart',
    'domainLookupStart - fetchStart',
    'domainLookupEnd - domainLookupStart',
    'connectEnd - connectStart',
    'connectEnd - secureConnectionStart',
    'responseStart - requestStart',
    'responseEnd - responseStart',
    'domContentLoadedEventStart - responseEnd',
    'domInteractive - domLoading',
    'domContentLoadedEventEnd - domContentLoadedEventStart',
    'loadEventStart - domContentLoadedEnd',
    'loadEventEnd - loadEventStart',
    'loadEventEnd - fetchStart'
  ];
  
  return stages.map((s, i) => ({ name: s.name, value: Math.round(s.f()), color: s.color, formula: formulas[i], parallel: s.parallel }));
}

/**
 * 收集资源数据并分类统计跨域请求
 * 
 * 跨域请求分类说明：
 * 1. 识别标准：transferSize 为 undefined 或 null（表示无法获取传输大小）
 * 2. 分类维度：按域名、资源类型、initiatorType 分类
 * 3. 统计内容：各类别下的请求数量
 * 
 * 返回数据结构：
 * - resources: 所有资源数据
 * - crossOriginRequests: 跨域请求统计数组
 *   - domain: 域名
 *   - count: 该域名下无法统计的请求数量
 *   - types: 该域名下各资源类型的分布（可选）
 */
function collectResources() {
  const resources = performance.getEntries().filter(e => e.entryType === 'resource');
  const crossOrigin = {};
  
  const processed = resources.map(r => {
    const domain = extractDomain(r.name);
    const type = getResourceType(r);
    const initiatorType = r.initiatorType;
    
    // 识别跨域请求（无法获取传输大小）
    if (!r.transferSize && r.transferSize !== 0) {
      if (!crossOrigin[domain]) {
        crossOrigin[domain] = {
          domain: domain,
          count: 0,
          types: {},
          initiatorTypes: {}
        };
      }
      crossOrigin[domain].count++;
      
      // 按资源类型分类
      crossOrigin[domain].types[type] = (crossOrigin[domain].types[type] || 0) + 1;
      
      // 按initiator类型分类
      crossOrigin[domain].initiatorTypes[initiatorType] = (crossOrigin[domain].initiatorTypes[initiatorType] || 0) + 1;
    }
    
    return {
      name: r.name,
      duration: r.responseEnd - r.startTime,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      startTime: r.startTime,
      domain,
      type,
      initiatorType,
      cached: r.transferSize === 0 && r.responseEnd > r.startTime
    };
  });
  
  // 转换为数组格式，包含详细的分类信息
  const crossOriginRequests = Object.values(crossOrigin).map(item => ({
    domain: item.domain,
    count: item.count,
    types: item.types,
    initiatorTypes: item.initiatorTypes
  }));
  
  return {
    resources: processed,
    crossOriginRequests
  };
}

function collectSlowResources(resources) {
  return {
    slowStatic: getSlowResources(resources, false),
    slowAjax: getSlowResources(resources, true)
  };
}

function renderMetrics(metrics) {
  const ids = ['fp', 'fRender', 'fInteractive', 'domReady', 'pageLoad', 'fpaint', 'fcPaint', 'fmPaint'];
  const keys = ['ttfb', 'firstRender', 'firstInteractive', 'domReady', 'pageLoad', 'firstPaint', 'fcp', 'fmp'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${Math.round(metrics[keys[i]])}ms`;
  });
  
  const ttfbCard = document.getElementById('fp')?.closest('.metric-card');
  if (ttfbCard) {
    ttfbCard.classList.remove('good', 'medium', 'bad');
    ttfbCard.classList.add(getMetricStatus(metrics.ttfb, 'ttfb'));
  }
}

function renderWaterfallChart(data) {
  const chartDom = document.getElementById('waterfallChart');
  if (!chartDom) return;
  
  let currentTime = 0;
  const processed = [];
  const syncs = {};
  
  data.forEach((item, idx) => {
    let start = item.parallel ? syncs[item.syncWith] || currentTime : currentTime;
    if (!item.parallel) syncs[item.name] = currentTime;
    currentTime += item.value;
    processed.push({ ...item, start, end: start + item.value, index: idx });
  });
  
  const BAR_HEIGHT = 18;
  
  const myChart = echarts.init(chartDom);
  myChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(235, 243, 255, 0.5)' } },
      formatter: p => {
        const d = processed[p[0].dataIndex];
        return `<div style="font-size:14px;font-weight:bold">${d.name}</div>
                <div style="color:#999;font-size:12px;margin-bottom:5px">${d.formula}</div>
                <span style="color:${d.color}">●</span> <b>${d.value} ms</b>`;
      }
    },
    grid: { top: 30, bottom: 60, left: 100, right: 80, containLabel: true },
    xAxis: {
      type: 'value',
      max: Math.ceil(currentTime / 100) * 100 + 50,
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
      axisLabel: { color: '#999' }
    },
    yAxis: {
      type: 'category',
      data: processed.map(d => d.name),
      inverse: true,
      axisLine: { lineStyle: { color: '#eee' } },
      axisTick: { alignWithLabel: true }
    },
    series: [
      { type: 'bar', stack: 'total', itemStyle: { color: 'transparent' }, data: processed.map(d => d.start), silent: true },
      {
        name: '耗时',
        type: 'bar',
        stack: 'total',
        barWidth: BAR_HEIGHT,
        itemStyle: { color: p => processed[p.dataIndex].color, borderRadius: 1 },
        label: { show: true, position: 'right', formatter: p => p.value > 0 ? p.value + ' ms' : '', color: '#666', fontSize: 11 },
        data: processed.map(d => d.value)
      },
      {
        type: 'custom',
        renderItem: (params, api) => {
          const i = params.dataIndex;
          const curr = processed[i];
          const prev = processed[i - 1];
          const style = { stroke: '#aaa', lineDash: [3, 3], lineWidth: 1 };
          
          if (i === 0) {
            const firstActive = processed.find(d => d.value > 0);
            if (!firstActive) return;
            const [x1, y1] = api.coord([0, 0]);
            const [x2, y2] = api.coord([firstActive.start, firstActive.index]);
            return { type: 'line', shape: { x1, y1, x2, y2: y2 - BAR_HEIGHT / 2 }, style };
          }
          
          if (curr.name === '总耗时') {
            const [x1, y1] = api.coord([prev.end, i - 1]);
            const [x2, y2] = api.coord([curr.end, i]);
            return { type: 'line', shape: { x1, y1: y1 + BAR_HEIGHT / 2, x2, y2: y2 - BAR_HEIGHT / 2 }, style };
          }
          
          const [x1, y1] = api.coord([prev.end, i - 1]);
          const [x2, y2] = api.coord([curr.start, i]);
          return { type: 'line', shape: { x1, y1: y1 + BAR_HEIGHT / 2, x2, y2: y2 - BAR_HEIGHT / 2 }, style };
        },
        data: processed,
        silent: true
      }
    ]
  });
  
  window.addEventListener('resize', () => myChart.resize());
}

/**
 * 渲染资源分析数据
 * 
 * 网络传输计算说明：
 * 1. 总传输大小 = 所有资源的 transferSize 之和（不包括缓存资源）
 * 2. 网络传输大小 = 所有有实际网络传输的资源的大小总和
 *    - 缓存资源（transferSize === 0）不计入网络传输
 *    - 跨域资源（transferSize 为 undefined 或 null）不计入网络传输
 * 3. 不同场景的传输大小差异：
 *    - 正常加载：transferSize = 实际传输的字节数
 *    - 缓存命中：transferSize = 0（无网络传输）
 *    - 跨域资源：transferSize = undefined（无法获取传输大小）
 *    - 压缩资源：transferSize = 压缩后的大小（encodedBodySize）
 * 
 * 跨域请求统计说明：
 * 1. 跨域请求识别：transferSize 为 undefined 或 null
 * 2. 分类统计：按域名分类统计无法获取大小的资源数量
 * 3. 显示逻辑：当存在跨域请求时，显示具体的无法统计的请求数量
 */
function renderResourceAnalysis({ resources, crossOriginRequests }) {
  // 验证数据
  resources = validateResources(resources);
  crossOriginRequests = validateCrossOriginRequests(crossOriginRequests);

  const domains = new Set(resources.map(r => r.domain));
  const totalRequests = resources.length;

  // 计算每个域名的请求数量和详细信息
  const domainCounts = {};
  const domainDetails = {};

  resources.forEach(r => {
    // 统计请求数
    domainCounts[r.domain] = (domainCounts[r.domain] || 0) + 1;

    // 收集详细信息
    if (!domainDetails[r.domain]) {
      domainDetails[r.domain] = {
        count: 0,
        durations: [],
        totalDuration: 0
      };
    }
    domainDetails[r.domain].count++;
    domainDetails[r.domain].durations.push(r.duration);
    domainDetails[r.domain].totalDuration += r.duration;
  });

  // 计算每个域名的统计信息
  Object.keys(domainDetails).forEach(domain => {
    const detail = domainDetails[domain];
    detail.avgDuration = detail.totalDuration / detail.count;
    detail.minDuration = Math.min(...detail.durations);
    detail.maxDuration = Math.max(...detail.durations);
  });

  // 保存域名数据到全局变量（用于展开显示）
  globalDomainData = {
    domains: Array.from(domains),
    domainCounts,
    totalRequests,
    domainDetails,
    resources
  };
  const totalTime = resources.reduce((sum, r) => sum + r.duration, 0);
  
  // 网络传输大小计算：只统计有实际网络传输的资源（transferSize > 0）
  const networkTransfer = resources.reduce((sum, r) => {
    if (r.transferSize && r.transferSize > 0) {
      return sum + r.transferSize;
    }
    return sum;
  }, 0);
  
  // 总传输大小：包括所有非缓存的资源
  const totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
  const totalActualSize = resources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
  
  // 统计无法统计的跨域请求数量
  const unstatableCrossOriginCount = crossOriginRequests.reduce((sum, r) => sum + r.count, 0);
  
  // 跨域无法统计请求显示逻辑
  let crossOriginDisplay;
  if (unstatableCrossOriginCount > 0) {
    crossOriginDisplay = `${unstatableCrossOriginCount}个`;
  } else {
    crossOriginDisplay = '0个';
  }
  
  const stats = [
    ['domainTotal', `${domains.size}个`],
    ['requestTotal', `${totalRequests}个`],
    ['totalTime', `${Math.round(totalTime)}ms`],
    ['avgTime', `${Math.round(totalRequests > 0 ? totalTime / totalRequests : 0)}ms`],
    ['networkTransfer', formatSize(networkTransfer)],
    ['compressedSize', formatSize(totalTransferSize)],
    ['actualSize', formatSize(totalActualSize)],
    ['crossDomainRequests', crossOriginDisplay]
  ];
  
  stats.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
  
  // 在控制台输出详细的网络传输和跨域请求数据统计信息（用于调试和验证）
  console.log('===== 网络传输统计详情 =====');
  console.log(`网络传输大小: ${formatSize(networkTransfer)}`);
  console.log(`  - 仅统计有实际网络传输的资源（transferSize > 0）`);
  console.log(`  - 排除缓存资源（transferSize === 0）`);
  console.log(`  - 排除跨域资源（transferSize undefined）`);
  console.log('');
  
  console.log(`总传输大小: ${formatSize(totalTransferSize)}`);
  console.log(`  - 包含所有非缓存资源的传输大小`);
  console.log('');
  
  console.log(`实际大小: ${formatSize(totalActualSize)}`);
  console.log(`  - 资源解压后的实际大小`);
  console.log('');
  
  console.log('===== 跨域无法统计请求详情 =====');
  console.log(`总数量: ${unstatableCrossOriginCount}个`);
  console.log(`  - 无法获取传输大小的资源（transferSize 为 undefined）`);
  console.log('');
  
  if (crossOriginRequests.length > 0) {
    console.log('按域名分类:');
    crossOriginRequests.forEach(item => {
      console.log(`  - ${item.domain}: ${item.count}个`);
      if (item.types) {
        console.log('    按资源类型:');
        Object.entries(item.types).forEach(([type, count]) => {
          console.log(`      ${type}: ${count}个`);
        });
      }
      if (item.initiatorTypes) {
        console.log('    按Initiator类型:');
        Object.entries(item.initiatorTypes).forEach(([initiator, count]) => {
          console.log(`      ${initiator}: ${count}个`);
        });
      }
    });
  }
  console.log('');
  
  console.log('===== 数据统计汇总 =====');
  console.log(`总请求数: ${totalRequests}个`);
  console.log(`  - 可统计资源: ${resources.filter(r => r.transferSize !== undefined).length}个`);
  console.log(`  - 无法统计资源（跨域）: ${unstatableCrossOriginCount}个`);
  console.log(`  - 缓存资源: ${resources.filter(r => r.cached).length}个`);
  console.log('==========================\n');
}

const CHART_COLORS = ['#4285f4', '#34a853', '#fbbc05', '#ea4335', '#9c27b0'];

// 存储图表实例以便导出
const chartInstances = {};

function createPieChart(id, labels, data, options = {}) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 12, padding: 10 }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value}个 (${percentage}%)`;
          }
        }
      }
    }
  };
  
  const chart = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: CHART_COLORS }] },
    options: { ...defaultOptions, ...options }
  });
  
  chartInstances[id] = chart;
  return chart;
}

function createBarChart(id, labels, data, label = '', color = '#4285f4', options = {}) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${label}: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#999' }
      },
      x: {
        ticks: { color: '#999' }
      }
    }
  };
  
  const chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: color }] },
    options: { ...defaultOptions, ...options }
  });
  
  chartInstances[id] = chart;
  return chart;
}

function countBy(resources, keyFn) {
  return resources.reduce((acc, r) => {
    const key = keyFn(r);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

/**
 * 三层域名分类
 * @param {Array} resources - 资源数组
 * @param {string} mainDomain - 主域名（用于判断同主域名）
 * @returns {Object} 三层分类统计
 */
function classifyDomains(resources, mainDomain) {
  const result = {
    sameDomain: 0,      // 本域名（完全相同）
    sameRootDomain: 0,  // 同主域名（二级域名相同）
    crossDomain: 0       // 跨域第三方
  };
  
  resources.forEach(r => {
    const domain = r.domain;
    
    // 完全相同
    if (domain === mainDomain) {
      result.sameDomain++;
    } else if (isSameRootDomain(domain, mainDomain)) {
      result.sameRootDomain++;
    } else {
      result.crossDomain++;
    }
  });
  
  return result;
}

/**
 * 判断两个域名是否属于同一个主域名
 * @param {string} domain1 - 域名1
 * @param {string} domain2 - 域名2
 * @returns {boolean} 是否同主域名
 */
function isSameRootDomain(domain1, domain2) {
  if (!domain1 || !domain2) return false;
  
  // 提取主域名（去掉子域名）
  const parts1 = domain1.split('.');
  const parts2 = domain2.split('.');
  
  // 至少需要两级域名
  if (parts1.length < 2 || parts2.length < 2) return false;
  
  // 比较主域名（最后两级）
  const root1 = parts1.slice(-2).join('.');
  const root2 = parts2.slice(-2).join('.');
  
  return root1 === root2;
}

/**
 * 创建三层域名分类饼图
 * @param {Array} resources - 资源数组
 * @param {string} mainDomain - 主域名
 */
function createDomainClassificationChart(resources, mainDomain) {
  const classification = classifyDomains(resources, mainDomain);
  const labels = ['本域名', '同主域名', '跨域第三方'];
  const data = [classification.sameDomain, classification.sameRootDomain, classification.crossDomain];
  const colors = ['#4285f4', '#34a853', '#ea4335']; // 蓝、绿、红
  
  createPieChart('domainDistChart', labels, data, {
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          padding: 10,
          generateLabels: function(chart) {
            const data = chart.data;
            return data.labels.map((label, i) => ({
              text: `${label}: ${data.datasets[0].data[i]}个`,
              fillStyle: colors[i],
              index: i
            }));
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label;
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value}个 (${percentage}%)`;
          }
        }
      }
    }
  });
  
  return classification;
}

/**
 * 创建域名分布统计表格
 * @param {Object} classification - 三层分类结果
 */
function createDomainDistTable(classification) {
  const tbody = document.querySelector('#domainDistTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  const total = classification.sameDomain + classification.sameRootDomain + classification.crossDomain;
  
  const rows = [
    { label: '同主域名', count: classification.sameDomain + classification.sameRootDomain },
    { label: '跨域第三方', count: classification.crossDomain }
  ];
  
  rows.forEach(row => {
    const tr = document.createElement('tr');
    const percentage = total > 0 ? ((row.count / total) * 100).toFixed(1) : 0;
    tr.innerHTML = `
      <td>${row.label}</td>
      <td>${row.count}个</td>
      <td>${percentage}%</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * 创建整体请求域名分布饼图（突出前5大域名）
 * @param {Array} resources - 资源数组
 */
function createOverallDomainChart(resources) {
  const domainCounts = countBy(resources, r => r.domain);
  
  // 按请求数量降序排序
  const sortedDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1]);
  
  // 取前5大域名
  const top5Domains = sortedDomains.slice(0, 5);
  const top5Count = top5Domains.reduce((sum, [, count]) => sum + count, 0);
  
  // 其他域名合并
  const otherCount = sortedDomains.slice(5).reduce((sum, [, count]) => sum + count, 0);
  
  let labels = top5Domains.map(([domain]) => domain);
  let data = top5Domains.map(([, count]) => count);
  
  if (otherCount > 0) {
    labels.push('其他');
    data.push(otherCount);
  }
  
  createPieChart('overallDomainChart', labels, data);
}

/**
 * 创建域名耗时对比条形图（含最大/最小耗时标注）
 * @param {Array} resources - 资源数组
 */
function createDomainTimeComparisonChart(resources) {
  // 计算每个域名的耗时统计
  const domainStats = {};
  
  resources.forEach(r => {
    const domain = r.domain;
    if (!domainStats[domain]) {
      domainStats[domain] = {
        totalDuration: 0,
        count: 0,
        maxDuration: 0,
        minDuration: Infinity
      };
    }
    
    const stats = domainStats[domain];
    stats.totalDuration += r.duration;
    stats.count += 1;
    stats.maxDuration = Math.max(stats.maxDuration, r.duration);
    stats.minDuration = Math.min(stats.minDuration, r.duration);
  });
  
  // 计算平均耗时并按平均耗时降序排序
  const sortedDomains = Object.entries(domainStats)
    .map(([domain, stats]) => ({
      domain,
      avgDuration: stats.totalDuration / stats.count,
      maxDuration: stats.maxDuration,
      minDuration: stats.minDuration === Infinity ? 0 : stats.minDuration,
      count: stats.count
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration);
  
  const labels = sortedDomains.map(d => d.domain);
  const avgData = sortedDomains.map(d => Math.round(d.avgDuration));
  const maxData = sortedDomains.map(d => Math.round(d.maxDuration));
  const minData = sortedDomains.map(d => Math.round(d.minDuration));
  
  createBarChart('domainTimeChart', labels, avgData, '平均耗时', '#4285f4', {
    indexAxis: 'y', // 横向条形图
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: function(context) {
            return sortedDomains[context[0].dataIndex]?.domain || '';
          },
          afterBody: function(context) {
            const index = context[0].dataIndex;
            const stats = sortedDomains[index];
            if (!stats) return '';
            return [
              `平均耗时: ${Math.round(stats.avgDuration)}ms`,
              `最大耗时: ${Math.round(stats.maxDuration)}ms`,
              `最小耗时: ${Math.round(stats.minDuration)}ms`,
              `请求数量: ${stats.count}个`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#999' }
      },
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: '耗时 (ms)',
          color: '#999'
        },
        ticks: { color: '#999' }
      }
    }
  });
}

/**
 * 渲染深度分析图表
 * @param {Object} params - 包含resources和crossOriginRequests的对象
 */
function renderDeepAnalysis({ resources, crossOriginRequests }) {
  // 验证数据
  resources = validateResources(resources);
  crossOriginRequests = validateCrossOriginRequests(crossOriginRequests);

  if (resources.length === 0) return;

  // 获取主域名（从第一个资源中提取）
  const mainDomain = resources[0]?.domain || '';

  // 1. 创建三层域名分类饼图
  const classification = createDomainClassificationChart(resources, mainDomain);

  // 2. 创建域名分布统计表格
  createDomainDistTable(classification);

  // 3. 创建整体请求域名分布饼图（突出前5大域名）
  createOverallDomainChart(resources);

  // 4. 创建域名耗时对比条形图（含最大/最小耗时标注）
  createDomainTimeComparisonChart(resources);

  // 5. 跨域分布 (No TAO)
  if (crossOriginRequests.length > 0) {
    createPieChart('taoDomainChart', crossOriginRequests.map(r => r.domain), crossOriginRequests.map(r => r.count));
  }

  // 6. 缓存命中率
  const cachedCount = resources.filter(r => r.cached).length;
  createPieChart('cacheRateChart', ['已缓存', '未缓存'], [cachedCount, resources.length - cachedCount]);

  // 其他统计图表
  const initiatorCounts = countBy(resources, r => r.initiatorType);
  const typeCounts = countBy(resources, r => r.type);
  const initiatorDomains = countBy(resources, r => `${r.initiatorType}@${r.domain}`);
  const typeDomains = countBy(resources, r => `${r.type}@${r.domain}`);

  createPieChart('initiatorTypeCountChart', Object.keys(initiatorCounts), Object.values(initiatorCounts));
  createBarChart('initiatorTypeDomainChart', Object.keys(initiatorDomains).slice(0, 10), Object.values(initiatorDomains).slice(0, 10), '数量', '#9c27b0');
  createPieChart('fileTypeCountChart', Object.keys(typeCounts), Object.values(typeCounts));
  createBarChart('fileTypeDomainChart', Object.keys(typeDomains).slice(0, 10), Object.values(typeDomains).slice(0, 10), '数量', '#ea4335');

  // 11. 渲染域名详细分析表格（自动加载）
  renderDomainDetailsTable();
}

/**
 * 渲染域名详细分析表格（自动加载）
 */
function renderDomainDetailsTable() {
  if (!globalDomainData.domainDetails || Object.keys(globalDomainData.domainDetails).length === 0) {
    return;
  }

  // 初始化分页
  domainPagination.totalDomains = Object.keys(globalDomainData.domainDetails).length;
  domainPagination.totalPages = Math.ceil(domainPagination.totalDomains / domainPagination.pageSize);
  domainPagination.currentPage = 1;

  renderDomainPage();
  updatePaginationInfo();
}

/**
 * 渲染当前页的域名数据
 */
function renderDomainPage() {
  const tbody = document.getElementById('domainDetailsBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // 按平均延迟降序排序
  const sortedDomains = Object.entries(globalDomainData.domainDetails)
    .sort((a, b) => b[1].avgDuration - a[1].avgDuration);

  // 计算当前页的域名范围
  const startIndex = (domainPagination.currentPage - 1) * domainPagination.pageSize;
  const endIndex = Math.min(startIndex + domainPagination.pageSize, sortedDomains.length);
  const currentDomains = sortedDomains.slice(startIndex, endIndex);

  // 渲染当前页的域名
  currentDomains.forEach(([domain, detail]) => {
    const tr = document.createElement('tr');

    // 计算该域名的传输大小和缓存命中数
    const domainResources = globalDomainData.resources.filter(r => r.domain === domain);
    const totalTransferSize = domainResources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const cachedCount = domainResources.filter(r => r.cached).length;
    const cachedPercentage = ((cachedCount / domainResources.length) * 100).toFixed(1);

    tr.innerHTML = `
      <td class="domain-name-cell" title="${domain}">${domain}</td>
      <td>${detail.count}个</td>
      <td>${Math.round(detail.avgDuration)}ms</td>
      <td>${Math.round(detail.minDuration)}ms</td>
      <td>${Math.round(detail.maxDuration)}ms</td>
      <td>${formatSize(totalTransferSize)}</td>
      <td>${cachedPercentage}% (${cachedCount}/${detail.count})</td>
      <td>
        <button class="action-btn" onclick="copySingleDomain('${domain}')">复制</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/**
 * 更新分页信息显示
 */
function updatePaginationInfo() {
  const pageInfo = document.getElementById('domainPageInfo');
  if (pageInfo) {
    pageInfo.textContent = `第 ${domainPagination.currentPage} 页 / 共 ${domainPagination.totalPages} 页`;
  }

  // 更新按钮状态
  const prevBtn = document.querySelector('.pagination-controls button:first-child');
  const nextBtn = document.querySelector('.pagination-controls button:last-child');

  if (prevBtn) {
    prevBtn.disabled = domainPagination.currentPage === 1;
    prevBtn.style.opacity = domainPagination.currentPage === 1 ? '0.5' : '1';
  }

  if (nextBtn) {
    nextBtn.disabled = domainPagination.currentPage === domainPagination.totalPages;
    nextBtn.style.opacity = domainPagination.currentPage === domainPagination.totalPages ? '0.5' : '1';
  }
}

/**
 * 上一页
 */
function prevDomainPage() {
  if (domainPagination.currentPage > 1) {
    domainPagination.currentPage--;
    renderDomainPage();
    updatePaginationInfo();
  }
}

/**
 * 下一页
 */
function nextDomainPage() {
  if (domainPagination.currentPage < domainPagination.totalPages) {
    domainPagination.currentPage++;
    renderDomainPage();
    updatePaginationInfo();
  }
}

function renderSlowResources({ slowStatic, slowAjax }) {
  const renderTable = (tableId, resources, showType) => {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = '';
    
    resources.forEach(r => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td title="${r.name}" onclick="copyDomain('${r.name}')">${r.name}</td>
        <td>${showType ? r.type : r.initiatorType}</td>
        <td>${r.name.startsWith('https') ? 'HTTPS' : 'HTTP'}</td>
        <td>${Math.round(r.duration)}</td>
        <td>${formatSize(r.transferSize)}</td>
        <td>${formatSize(r.encodedBodySize)}</td>
        <td>${formatSize(r.decodedBodySize)}</td>
      `;
      tbody.appendChild(row);
    });
  };
  
  renderTable('slowResourceTable', slowStatic, true);
  renderTable('slowAjaxTable', slowAjax, false);
}

/**
 * 导出图表为PNG或SVG
 * @param {HTMLElement} btn - 导出按钮元素
 */
function exportChart(btn) {
  const chartId = btn.getAttribute('data-chart');
  const chart = chartInstances[chartId];
  
  if (!chart) {
    showToast('图表不存在，无法导出');
    return;
  }
  
  // 创建导出选择菜单
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 9999;
    min-width: 200px;
  `;
  
  menu.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 15px; color: #0f172a;">导出图表</div>
    <button id="exportPNG" style="
      display: block;
      width: 100%;
      padding: 10px;
      margin-bottom: 8px;
      background: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    ">导出为 PNG</button>
    <button id="exportSVG" style="
      display: block;
      width: 100%;
      padding: 10px;
      margin-bottom: 8px;
      background: #34a853;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    ">导出为 SVG</button>
    <button id="cancelExport" style="
      display: block;
      width: 100%;
      padding: 10px;
      background: #64748b;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    ">取消</button>
  `;
  
  document.body.appendChild(menu);
  
  // 导出PNG
  document.getElementById('exportPNG').addEventListener('click', () => {
    try {
      const link = document.createElement('a');
      link.download = `${chartId}-chart.png`;
      link.href = chart.toBase64Image();
      link.click();
      showToast('图表已导出为 PNG');
    } catch (error) {
      console.error('导出PNG失败:', error);
      showToast('导出失败，请重试');
    }
    document.body.removeChild(menu);
  });
  
  // 导出SVG（使用外部库或手动创建）
  document.getElementById('exportSVG').addEventListener('click', () => {
    try {
      // Chart.js 默认不直接支持SVG导出，这里我们提供一个提示
      // 可以使用 chartjs-plugin-doughnutlabel 或其他插件
      // 或者使用 canvas-to-blob 库
      showToast('SVG导出功能需要额外支持，已导出为 PNG');
      
      // 降级为PNG导出
      const link = document.createElement('a');
      link.download = `${chartId}-chart.png`;
      link.href = chart.toBase64Image();
      link.click();
    } catch (error) {
      console.error('导出SVG失败:', error);
      showToast('导出失败，请重试');
    }
    document.body.removeChild(menu);
  });
  
  // 取消导出
  document.getElementById('cancelExport').addEventListener('click', () => {
    document.body.removeChild(menu);
  });
  
  // 点击外部关闭菜单
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (menu.parentNode && !menu.contains(e.target)) {
        document.body.removeChild(menu);
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 100);
}

function copyDomain(url) {
  const domain = extractDomain(url);
  const text = document.createElement('textarea');
  text.value = domain;
  text.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(text);
  text.select();
  
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(domain).then(() => showToast('已复制域名！')).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  } catch {
    fallbackCopy(text);
  }
}

function fallbackCopy(textarea) {
  try {
    document.execCommand('copy');
    showToast('已复制域名！');
  } catch {
    showToast('复制失败，请手动复制');
  }
  document.body.removeChild(textarea);
}

function showToast(message) {
  const toast = document.querySelector('.copy-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

async function collectFromTab(tab) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      let navigation = null;
      try {
        const nav = performance.getEntries().filter(e => e.entryType === 'navigation');
        if (nav.length > 0) navigation = nav[0];
      } catch {
        navigation = performance.timing;
      }
      
      const resources = performance.getEntries().filter(e => e.entryType === 'resource');
      
      const crossOrigin = {};
      const processed = resources.map(r => {
        const domain = new URL(r.name).hostname;
        const type = r.name.includes('.js') ? 'js' : 
                    r.name.includes('.css') ? 'css' :
                    r.name.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)/) ? 'image' :
                    r.name.match(/\.(woff|woff2|ttf|eot)/) ? 'font' :
                    r.initiatorType === 'xmlhttprequest' || r.initiatorType === 'fetch' ? 'xhr' : 'other';
        const initiatorType = r.initiatorType;
        
        // 识别跨域请求（无法获取传输大小）并分类统计
        if (!r.transferSize && r.transferSize !== 0) {
          if (!crossOrigin[domain]) {
            crossOrigin[domain] = {
              domain: domain,
              count: 0,
              types: {},
              initiatorTypes: {}
            };
          }
          crossOrigin[domain].count++;
          crossOrigin[domain].types[type] = (crossOrigin[domain].types[type] || 0) + 1;
          crossOrigin[domain].initiatorTypes[initiatorType] = (crossOrigin[domain].initiatorTypes[initiatorType] || 0) + 1;
        }
        
        return {
          name: r.name,
          duration: r.responseEnd - r.startTime,
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
          decodedBodySize: r.decodedBodySize,
          startTime: r.startTime,
          domain,
          type,
          initiatorType,
          cached: r.transferSize === 0 && r.responseEnd > r.startTime
        };
      });
      
      const paintEntries = performance.getEntries().filter(e => e.entryType === 'paint');
      const lcpEntries = performance.getEntries().filter(e => e.entryType === 'largest-contentful-paint');
      
      let firstPaint = 0, fcp = 0;
      paintEntries.forEach(e => {
        if (e.name === 'first-paint' && e.startTime > 0) firstPaint = Math.round(e.startTime);
        if (e.name === 'first-contentful-paint' && e.startTime > 0) fcp = Math.round(e.startTime);
      });
      
      let fmp = 0;
      if (lcpEntries.length > 0) {
        const lastLcp = lcpEntries[lcpEntries.length - 1];
        fmp = Math.round(lastLcp.startTime || lastLcp.renderTime);
      }
      
      return {
        navigation: navigation ? {
          fetchStart: navigation.fetchStart,
          domainLookupStart: navigation.domainLookupStart,
          requestStart: navigation.requestStart,
          responseStart: navigation.responseStart,
          responseEnd: navigation.responseEnd,
          domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
          loadEventEnd: navigation.loadEventEnd,
          domInteractive: navigation.domInteractive,
          domContentLoadedEventStart: navigation.domContentLoadedEventStart,
          loadEventStart: navigation.loadEventStart,
          navigationStart: navigation.navigationStart || 0
        } : null,
        firstPaint,
        fcp,
        fmp,
        resources: processed,
        crossOriginRequests: Object.values(crossOrigin).map(item => ({
          domain: item.domain,
          count: item.count,
          types: item.types,
          initiatorTypes: item.initiatorTypes
        }))
      };
    }
  });
  
  return results[0]?.result;
}

function processMetricsFromData(data) {
  const nav = data.navigation;
  const firstRender = nav.responseEnd - nav.fetchStart;
  const metrics = {
    ttfb: nav.responseStart - nav.domainLookupStart,
    firstRender: firstRender,
    firstInteractive: nav.domInteractive - nav.fetchStart,
    domReady: nav.domContentLoadedEventEnd - nav.fetchStart,
    pageLoad: nav.loadEventStart - nav.fetchStart,
    firstPaint: data.firstPaint || firstRender,
    fcp: data.fcp || firstRender,
    fmp: data.fmp || data.fcp || firstRender
  };
  
  return metrics;
}

async function initApp() {
  try {
    const isExtension = typeof chrome !== 'undefined' && chrome.tabs;
    let performanceData;
    
    if (isExtension) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab?.url.startsWith('http')) {
        try {
          const data = await collectFromTab(tab);
          if (data?.navigation) {
            data.resources.forEach(r => r.type = getResourceType(r));
            const metrics = processMetricsFromData(data);
            const waterfallData = collectWaterfallData(data.navigation);
            const slowData = collectSlowResources(data.resources);
            
            performanceData = {
              metrics,
              waterfallData,
              resourceData: { resources: data.resources, crossOriginRequests: data.crossOriginRequests },
              slowResources: slowData
            };
          } else {
            performanceData = generateMockData();
          }
        } catch (e) {
          console.error('注入脚本失败:', e);
          performanceData = generateMockData();
        }
      } else {
        performanceData = generateMockData();
      }
    } else {
      performanceData = generateMockData();
    }
    
    renderAllData(performanceData);
  } catch (error) {
    console.error('初始化失败:', error);
    renderAllData(generateMockData());
  }
}

function generateMockData() {
  const mockResources = generateMockResources();
  return {
    metrics: generateMockMetrics(),
    waterfallData: generateMockWaterfallData(),
    resourceData: { resources: mockResources, crossOriginRequests: generateMockCrossOriginRequests() },
    slowResources: { slowStatic: getSlowResources(mockResources, false), slowAjax: getSlowResources(mockResources, true) }
  };
}

function renderAllData(data) {
  renderMetrics(data.metrics);
  renderWaterfallChart(data.waterfallData);
  renderResourceAnalysis(data.resourceData);
  renderDeepAnalysis(data.resourceData);
  renderSlowResources(data.slowResources);
}
/**
 * 复制单个域名
 * @param {string} domain - 要复制的域名
 */
function copySingleDomain(domain) {
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(domain)
        .then(() => showToast(`已复制域名: ${domain}`))
        .catch(() => fallbackCopyDomain(domain));
    } else {
      fallbackCopyDomain(domain);
    }
  } catch (error) {
    console.error('复制域名失败:', error);
    showToast('复制失败，请手动复制');
  }
}

/**
 * 降级复制域名方法
 * @param {string} text - 要复制的文本
 */
function fallbackCopyDomain(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    showToast('已复制域名！');
  } catch (error) {
    console.error('复制失败:', error);
    showToast('复制失败，请手动复制');
  }
  
  document.body.removeChild(textarea);
}

/**
 * 复制所有域名
 */
function copyAllDomains() {
  const domains = globalDomainData.domains;
  if (domains.length === 0) {
    showToast('暂无域名数据');
    return;
  }
  
  try {
    if (navigator.clipboard?.writeText) {
      const domainText = domains.join('\n');
      navigator.clipboard.writeText(domainText)
        .then(() => {
          showToast(`已复制 ${domains.length} 个域名！`);
        })
        .catch((error) => {
          console.error('复制所有域名失败:', error);
          fallbackCopyAllDomains(domains);
        });
    } else {
      fallbackCopyAllDomains(domains);
    }
  } catch (error) {
    console.error('复制所有域名失败:', error);
    showToast('复制失败，请手动复制');
  }
}

/**
 * 降级复制所有域名方法
 * @param {Array} domains - 域名数组
 */
function fallbackCopyAllDomains(domains) {
  const textarea = document.createElement('textarea');
  textarea.value = domains.join('\n');
  textarea.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    showToast(`已复制 ${domains.length} 个域名！`);
  } catch (error) {
    console.error('复制失败:', error);
    showToast('复制失败，请手动复制');
  }
  
  document.body.removeChild(textarea);
}

document.addEventListener('DOMContentLoaded', initApp);
