// Web性能分析插件 - 完全基于 Performance API

const THRESHOLDS = {
  ttfb: { good: 200, medium: 600 },
  fcp: { good: 1800, medium: 3000 },
  lcp: { good: 2500, medium: 4000 }
};

const SLOW_THRESHOLD = 40;

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

function collectResources() {
  const resources = performance.getEntries().filter(e => e.entryType === 'resource');
  const crossOrigin = {};
  
  const processed = resources.map(r => {
    const domain = extractDomain(r.name);
    if (!r.transferSize && r.transferSize !== 0) {
      crossOrigin[domain] = (crossOrigin[domain] || 0) + 1;
    }
    return {
      name: r.name,
      duration: r.responseEnd - r.startTime,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      startTime: r.startTime,
      domain,
      type: getResourceType(r),
      initiatorType: r.initiatorType,
      cached: r.transferSize === 0 && r.responseEnd > r.startTime
    };
  });
  
  return {
    resources: processed,
    crossOriginRequests: Object.entries(crossOrigin).map(([d, c]) => ({ domain: d, count: c }))
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

function renderResourceAnalysis({ resources, crossOriginRequests }) {
  const domains = new Set(resources.map(r => r.domain));
  const totalRequests = resources.length;
  const totalTime = resources.reduce((sum, r) => sum + r.duration, 0);
  const networkTime = resources.reduce((sum, r) => sum + (r.transferSize > 0 ? r.duration : 0), 0);
  const totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
  const totalActualSize = resources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
  const compressionRate = totalActualSize > 0 ? ((1 - totalTransferSize / totalActualSize) * 100).toFixed(1) : 0;
  
  const stats = [
    ['domainTotal', `${domains.size}个`],
    ['requestTotal', `${totalRequests}个`],
    ['totalTime', `${Math.round(totalTime)}ms`],
    ['avgTime', `${Math.round(totalRequests > 0 ? totalTime / totalRequests : 0)}ms`],
    ['networkTime', `${Math.round(networkTime)}ms`],
    ['compressedSize', formatSize(totalTransferSize)],
    ['actualSize', formatSize(totalActualSize)],
    ['compressionRate', `${compressionRate}%`],
    ['crossDomainRequests', `${crossOriginRequests.length}个`]
  ];
  
  stats.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

const CHART_COLORS = ['#4285f4', '#34a853', '#fbbc05', '#ea4335', '#9c27b0'];

function createPieChart(id, labels, data) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: CHART_COLORS }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } }
  });
}

function createBarChart(id, labels, data, label = '', color = '#4285f4') {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: color }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function countBy(resources, keyFn) {
  return resources.reduce((acc, r) => {
    const key = keyFn(r);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function renderDeepAnalysis({ resources, crossOriginRequests }) {
  const domainCounts = countBy(resources, r => r.domain);
  const domainTimes = resources.reduce((acc, r) => {
    acc[r.domain] = (acc[r.domain] || 0) + r.duration;
    return acc;
  }, {});
  const initiatorCounts = countBy(resources, r => r.initiatorType);
  const typeCounts = countBy(resources, r => r.type);
  const initiatorDomains = countBy(resources, r => `${r.initiatorType}@${r.domain}`);
  const typeDomains = countBy(resources, r => `${r.type}@${r.domain}`);
  
  const labels = Object.keys(domainCounts);
  const values = Object.values(domainCounts);
  
  createPieChart('reqCountDomainChart', labels, values);
  createPieChart('domainDistChart', labels, values);
  createBarChart('reqDomainChart', labels, values, '请求数', '#4285f4');
  createBarChart('domainTimeChart', labels, Object.values(domainTimes).map(v => Math.round(v)), '耗时 (ms)', '#34a853');
  
  if (crossOriginRequests.length > 0) {
    createPieChart('taoDomainChart', crossOriginRequests.map(r => r.domain), crossOriginRequests.map(r => r.count));
  }
  
  const cachedCount = resources.filter(r => r.cached).length;
  createPieChart('cacheRateChart', ['已缓存', '未缓存'], [cachedCount, resources.length - cachedCount]);
  
  const textResources = resources.filter(r => ['js', 'css', 'html', 'json'].includes(r.type));
  const compressedText = textResources.filter(r => r.transferSize > 0 && r.decodedBodySize > r.transferSize).length;
  createPieChart('textCompressChart', ['已压缩', '未压缩'], [compressedText, textResources.length - compressedText]);
  
  const uncompressedDomains = textResources.filter(r => r.decodedBodySize <= r.transferSize || r.transferSize === 0).reduce((acc, r) => {
    acc[r.domain] = (acc[r.domain] || 0) + 1;
    return acc;
  }, {});
  
  if (Object.keys(uncompressedDomains).length > 0) {
    createBarChart('unCompressDomainChart', Object.keys(uncompressedDomains), Object.values(uncompressedDomains), '未压缩文件数', '#ea4335');
  }
  
  createPieChart('initiatorTypeCountChart', Object.keys(initiatorCounts), Object.values(initiatorCounts));
  createBarChart('initiatorTypeDomainChart', Object.keys(initiatorDomains).slice(0, 10), Object.values(initiatorDomains).slice(0, 10), '数量', '#9c27b0');
  createPieChart('fileTypeCountChart', Object.keys(typeCounts), Object.values(typeCounts));
  createBarChart('fileTypeDomainChart', Object.keys(typeDomains).slice(0, 10), Object.values(typeDomains).slice(0, 10), '数量', '#ea4335');
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
      const processed = resources.map(r => ({
        name: r.name,
        duration: r.responseEnd - r.startTime,
        transferSize: r.transferSize,
        encodedBodySize: r.encodedBodySize,
        decodedBodySize: r.decodedBodySize,
        startTime: r.startTime,
        domain: new URL(r.name).hostname,
        initiatorType: r.initiatorType,
        cached: r.transferSize === 0 && r.responseEnd > r.startTime
      }));
      
      const crossOrigin = {};
      processed.forEach(r => {
        if (!r.transferSize && r.transferSize !== 0) crossOrigin[r.domain] = (crossOrigin[r.domain] || 0) + 1;
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
        crossOriginRequests: Object.entries(crossOrigin).map(([d, c]) => ({ domain: d, count: c }))
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

document.addEventListener('DOMContentLoaded', initApp);
