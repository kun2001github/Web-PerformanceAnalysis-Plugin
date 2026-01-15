# Requirements Document

## Introduction

本文档定义了一个Web性能分析浏览器插件的需求规范。该插件兼容Chrome和Edge浏览器，使用Performance API收集和分析网页性能数据，在本地进行数据处理和可视化展示，不会收集或上传用户数据，也不会对当前网页造成任何破坏。

## Glossary

- **Extension**: 浏览器扩展插件
- **Performance_API**: 浏览器提供的性能测量接口
- **Navigation_Timing**: 浏览器导航时序API
- **Resource_Timing**: 浏览器资源加载时序API
- **Waterfall_Chart**: 瀑布流图表，展示各阶段时序关系
- **TTFB**: Time To First Byte，首字节时间
- **DOM_Ready**: DOM内容加载完成事件
- **Core_Metrics**: 核心性能指标
- **Toolbar**: 浏览器工具栏
- **Popup**: 插件弹出窗口界面

## Requirements

### Requirement 1: 浏览器兼容性

**User Story:** 作为用户，我希望插件能在Chrome和Edge浏览器上运行，以便在不同浏览器环境下使用性能分析功能。

#### Acceptance Criteria

1. WHEN the Extension is installed on Chrome browser THEN the Extension SHALL function correctly with all features available
2. WHEN the Extension is installed on Edge browser THEN the Extension SHALL function correctly with all features available
3. THE Extension SHALL use Manifest V3 format for browser compatibility

### Requirement 2: 关键性能指标展示

**User Story:** 作为开发者，我希望查看页面的关键性能指标，以便快速了解页面加载性能。

#### Acceptance Criteria

1. WHEN a page finishes loading THEN the Extension SHALL calculate and display the first byte time as `responseStart - domainLookupStart`
2. WHEN a page finishes loading THEN the Extension SHALL calculate and display the first render time as `responseEnd - fetchStart`
3. WHEN a page finishes loading THEN the Extension SHALL calculate and display the first interactive time as `domInteractive - fetchStart`
4. WHEN a page finishes loading THEN the Extension SHALL calculate and display the DOM Ready time as `domContentLoadedEventEnd - fetchStart`
5. WHEN a page finishes loading THEN the Extension SHALL calculate and display the page load time as `loadEventStart - fetchStart`
6. THE Extension SHALL display the page load time in the Toolbar icon badge

### Requirement 3: 性能阶段瀑布流展示

**User Story:** 作为开发者，我希望看到页面加载各阶段的瀑布流图表，以便分析各阶段的耗时分布。

#### Acceptance Criteria

1. WHEN the Popup is opened THEN the Extension SHALL display a Waterfall_Chart showing all performance stages
2. THE Waterfall_Chart SHALL include unLoad stage calculated as `unloadEventEnd - unloadEventStart`
3. THE Waterfall_Chart SHALL include Redirect stage calculated as `redirectEnd - redirectStart`
4. THE Waterfall_Chart SHALL include AppCache stage calculated as `domainLookupStart - fetchStart`
5. THE Waterfall_Chart SHALL include DNS stage calculated as `domainLookupEnd - domainLookupStart`
6. THE Waterfall_Chart SHALL include TCP stage calculated as `connectEnd - connectStart`
7. THE Waterfall_Chart SHALL include TTFB stage calculated as `responseStart - requestStart`
8. THE Waterfall_Chart SHALL include data transfer stage calculated as `responseEnd - responseStart`
9. THE Waterfall_Chart SHALL include DOM stage calculated as `domContentLoadedEventStart - responseEnd`
10. THE Waterfall_Chart SHALL include DCL stage calculated as `domContentLoadedEventEnd - domContentLoadedEventStart`
11. THE Waterfall_Chart SHALL include resource loading stage calculated as `loadEventStart - domContentLoadedEventEnd`
12. THE Waterfall_Chart SHALL include onLoad stage calculated as `loadEventEnd - loadEventStart`

### Requirement 4: 资源分析统计

**User Story:** 作为开发者，我希望查看页面资源的详细统计信息，以便优化资源加载策略。

#### Acceptance Criteria

1. WHEN the Popup is opened THEN the Extension SHALL display the total number of resource requests
2. WHEN the Popup is opened THEN the Extension SHALL display the total size of loaded resources
3. WHEN the Popup is opened THEN the Extension SHALL display the distribution of resources across different domains
4. WHEN the Popup is opened THEN the Extension SHALL display the average loading time for each domain
5. WHEN the Popup is opened THEN the Extension SHALL identify and display domains without proper response headers
6. WHEN the Popup is opened THEN the Extension SHALL display HTTP compression statistics including uncompressed resources
7. WHEN the Popup is opened THEN the Extension SHALL display cache hit rate statistics
8. WHEN the Popup is opened THEN the Extension SHALL categorize and display resources by type (script, stylesheet, image, etc.)
9. WHEN the Popup is opened THEN the Extension SHALL display loading time for each resource and AJAX request

### Requirement 5: 域名复制功能

**User Story:** 作为开发者，我希望能一键复制请求的域名，以便快速获取域名信息用于其他用途。

#### Acceptance Criteria

1. WHEN a user clicks on a domain name in the resource list THEN the Extension SHALL copy the domain name to the clipboard
2. WHEN a domain name is copied THEN the Extension SHALL provide visual feedback confirming the copy action
3. THE Extension SHALL support copying domain names from all resource entries

### Requirement 6: 工具栏显示

**User Story:** 作为用户，我希望在浏览器工具栏看到页面加载时间，以便快速了解当前页面性能。

#### Acceptance Criteria

1. WHEN a page finishes loading THEN the Extension SHALL display the total load time in the Toolbar icon badge
2. WHEN the load time exceeds a threshold THEN the Extension SHALL change the badge color to indicate performance issues
3. WHEN a user clicks the Toolbar icon THEN the Extension SHALL open the Popup with detailed performance information

### Requirement 7: 数据隐私保护

**User Story:** 作为用户，我希望我的浏览数据保持私密，插件不会收集或上传任何数据。

#### Acceptance Criteria

1. THE Extension SHALL process all performance data locally in the browser
2. THE Extension SHALL NOT send any data to remote servers
3. THE Extension SHALL NOT store any user browsing history or personal information
4. THE Extension SHALL NOT modify or interfere with the current webpage content or functionality

### Requirement 8: Performance API 数据采集

**User Story:** 作为系统，我需要使用标准的Performance API采集性能数据，以确保数据的准确性和可靠性。

#### Acceptance Criteria

1. WHEN a page loads THEN the Extension SHALL use Navigation_Timing API to collect navigation timing data
2. WHEN a page loads THEN the Extension SHALL use Resource_Timing API to collect resource loading data
3. WHEN timing data is unavailable THEN the Extension SHALL handle the absence gracefully and display appropriate messages
4. THE Extension SHALL collect performance data only after the page load event completes

### Requirement 9: 用户界面展示

**User Story:** 作为用户，我希望有清晰直观的界面展示性能数据，以便快速理解分析结果。

#### Acceptance Criteria

1. WHEN the Popup is opened THEN the Extension SHALL display performance data in a structured and readable format
2. THE Popup SHALL organize information into sections: Core_Metrics, Waterfall_Chart, and resource analysis
3. THE Popup SHALL use visual elements (charts, colors, icons) to enhance data readability
4. THE Popup SHALL support scrolling when content exceeds the visible area
5. THE Popup SHALL maintain consistent styling and layout across different screen sizes
