/**
 * Chrome扩展的popup脚本
 * 负责处理用户界面交互和与后台脚本的通信
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async () => {
  // 绑定事件监听器
  document.getElementById('extract-cookies').addEventListener('click', extractCookies);
  document.getElementById('inject-cookies').addEventListener('click', injectCookies);
  document.getElementById('save-cookies').addEventListener('click', saveCookies);
  document.getElementById('load-saved-cookies').addEventListener('click', loadSavedCookies);
  document.getElementById('refresh-saved-cookies').addEventListener('click', refreshSavedCookiesList);
  document.getElementById('load-url').addEventListener('click', loadCurrentTabUrl);
  document.getElementById('copy-json').addEventListener('click', copyJson);
  document.getElementById('copy-tokens').addEventListener('click', copyTokensByName);

  // 监听JSON文本变化，自动更新表格视图和缓存
  document.getElementById('cookies-json').addEventListener('input', function() {
    updateTableFromJson();
    cacheCookieData();
  });

  // 全选/取消全选功能
  document.getElementById('select-all-cookies').addEventListener('click', function() {
    const isChecked = this.checked;
    document.querySelectorAll('#cookies-table-body input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = isChecked;
    });
  });

  // 表格滚动时收起提示（不要监听 window.resize：扩展弹窗里显示 tooltip 常会触发伪 resize，导致闪一下就没了）
  document.getElementById('cookies-table-container').addEventListener('scroll', hideAppTooltip);

  // 图标按钮：即时自定义 tooltip（原生 title 有约 2s 延迟）
  document.querySelectorAll('[data-tooltip]').forEach(bindInstantTooltip);

  // 表格单元格长文案提示
  document.addEventListener('mousedown', hideAppTooltip);

  // 初始化页面
  await loadCurrentTabUrl();
  await refreshSavedCookiesList();

  // 加载缓存的Cookie数据
  await loadCachedCookieData();
});

/**
 * 缓存Cookie数据到background.js
 */
async function cacheCookieData() {
  const cookiesJson = document.getElementById('cookies-json').value.trim();
  try {
    await chrome.runtime.sendMessage({
      action: 'cacheCookieData',
      cookiesJson
    });
  } catch (error) {
    console.warn('缓存Cookie数据失败:', error);
  }
}

/**
 * 从background.js加载缓存的Cookie数据
 */
async function loadCachedCookieData() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'loadCachedCookieData'
    });
    if (response && response.success && response.cachedData) {
      document.getElementById('cookies-json').value = response.cachedData;
      updateTableFromJson();
    }
  } catch (error) {
    console.error('加载缓存的Cookie数据失败:', error);
  }
}

/**
 * 显示消息
 * @param {string} text - 消息文本
 * @param {boolean} isSuccess - 是否为成功消息
 */
function showMessage(text, isSuccess = true) {
  const messageElement = document.getElementById('message');
  messageElement.textContent = text;
  messageElement.className = `message ${isSuccess ? 'success' : 'error'}`;
  
  // 3秒后自动隐藏消息
  setTimeout(() => {
    messageElement.style.display = 'none';
  }, 3000);
}

/**
 * 加载当前标签页的URL
 */
async function loadCurrentTabUrl() {
  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrlInput = document.getElementById('current-url');
      const targetUrlInput = document.getElementById('target-url');
      let url = new URL(tab.url);
      currentUrlInput.value = url.origin;
      targetUrlInput.value = url.origin;
  } catch (error) {
    showMessage(`加载URL失败: ${error.message}`, false);
  }
}

/**
 * 从当前页面提取Cookie
 */
async function extractCookies() {
  const url = document.getElementById('current-url').value.trim();
  
  if (!url) {
    showMessage('请输入URL', false);
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'extractCookies',
      url
    });
    
    if (response.success) {
      document.getElementById('cookies-json').value = JSON.stringify(response.cookies, null, 2);
      updateTableFromJson(); // 更新表格视图
      await cacheCookieData(); // 缓存Cookie数据
      showMessage(`成功提取 ${response.cookies.length} 个Cookie`);
    } else {
      showMessage(`提取Cookie失败: ${response.error}`, false);
    }
  } catch (error) {
    showMessage(`提取Cookie失败: ${error.message}`, false);
  }
}

/**
 * 向目标URL注入Cookie
 */
async function injectCookies() {
  const url = document.getElementById('target-url').value.trim();
  const cookiesJson = document.getElementById('cookies-json').value.trim();
  
  if (!url) {
    showMessage('请输入目标URL', false);
    return;
  }
  
  if (!cookiesJson) {
    showMessage('请输入Cookie数据', false);
    return;
  }
  
  try {
    const cookies = JSON.parse(cookiesJson);

    // 表格视图下按勾选过滤，有勾选则只注入勾选项
    let cookiesToInject = cookies;
    const checkedCheckboxes = document.querySelectorAll('#cookies-table-body input[type="checkbox"]:checked');

    if (checkedCheckboxes.length > 0) {
      const checkedIndices = Array.from(checkedCheckboxes).map(checkbox =>
        parseInt(checkbox.id.replace('cookie-', ''))
      );
      cookiesToInject = cookies.filter((_, index) => checkedIndices.includes(index));
    }

    const response = await chrome.runtime.sendMessage({
      action: 'injectCookies',
      url,
      cookies: cookiesToInject
    });
    
    if (response.success) {
      showMessage('成功注入Cookie');
    } else {
      showMessage(`注入Cookie失败: ${response.error}`, false);
    }
  } catch (error) {
    showMessage(`解析Cookie失败: ${error.message}`, false);
  }
}

/**
 * 保存Cookie集到本地存储
 */
async function saveCookies() {
  const name = document.getElementById('cookie-set-name').value.trim();
  const cookiesJson = document.getElementById('cookies-json').value.trim();
  
  if (!name) {
    showMessage('请输入Cookie集名称', false);
    return;
  }
  
  if (!cookiesJson) {
    showMessage('请输入Cookie数据', false);
    return;
  }
  
  try {
    const cookies = JSON.parse(cookiesJson);
    
    const response = await chrome.runtime.sendMessage({
      action: 'saveCookies',
      name,
      cookies
    });
    
    if (response.success) {
      showMessage(`成功保存Cookie集: ${name}`);
      await refreshSavedCookiesList();
    } else {
      showMessage(`保存Cookie集失败: ${response.error}`, false);
    }
  } catch (error) {
    showMessage(`保存Cookie集失败: ${error.message}`, false);
  }
}

/**
 * 从本地存储加载Cookie集
 */
async function loadSavedCookies() {
  const name = document.getElementById('cookie-set-name').value.trim();
  
  if (!name) {
    showMessage('请输入要加载的Cookie集名称', false);
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'loadCookies',
      name
    });
    
    if (response.success) {
      document.getElementById('cookies-json').value = JSON.stringify(response.cookies, null, 2);
      updateTableFromJson(); // 更新表格视图
      await cacheCookieData(); // 缓存Cookie数据
      showMessage(`成功加载Cookie集: ${name}`);
    } else {
      showMessage(`加载Cookie集失败: ${response.error}`, false);
    }
  } catch (error) {
    showMessage(`加载Cookie集失败: ${error.message}`, false);
  }
}

/**
 * 刷新已保存的Cookie集列表
 */
async function refreshSavedCookiesList() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getSavedCookieNames'
    });
    
    const listElement = document.getElementById('saved-cookies-list');
    listElement.innerHTML = '';
    
    if (response.success && response.names && response.names.length > 0) {
      response.names.forEach(name => {
        const itemElement = document.createElement('div');
        itemElement.className = 'saved-cookie-item';
        
        const nameElement = document.createElement('span');
        nameElement.textContent = name;
        
        const actionsElement = document.createElement('div');
        actionsElement.className = 'saved-cookie-actions';

        const useButton = document.createElement('button');
        useButton.type = 'button';
        useButton.className = 'icon-btn small secondary';
        useButton.setAttribute('data-tooltip', '使用');
        useButton.setAttribute('aria-label', '使用');
        useButton.innerHTML =
          '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
        bindInstantTooltip(useButton);
        useButton.addEventListener('click', async () => {
          const loadResponse = await chrome.runtime.sendMessage({
            action: 'loadCookies',
            name
          });

          if (loadResponse.success) {
            document.getElementById('cookies-json').value = JSON.stringify(loadResponse.cookies, null, 2);
            updateTableFromJson(); // 更新表格视图
            await cacheCookieData(); // 缓存Cookie数据
            showMessage(`已加载Cookie集: ${name}`);
          }
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'icon-btn small danger';
        deleteButton.setAttribute('data-tooltip', '删除');
        deleteButton.setAttribute('aria-label', '删除');
        deleteButton.innerHTML =
          '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
        bindInstantTooltip(deleteButton);
        deleteButton.addEventListener('click', async () => {
          if (confirm(`确定要删除Cookie集: ${name}吗？`)) {
            const deleteResponse = await chrome.runtime.sendMessage({
              action: 'deleteCookies',
              name
            });

            if (deleteResponse.success) {
              showMessage(`已删除Cookie集: ${name}`);
              refreshSavedCookiesList(); // 刷新列表
            } else {
              showMessage(`删除Cookie集失败: ${deleteResponse.error}`, false);
            }
          }
        });

        actionsElement.appendChild(useButton);
        actionsElement.appendChild(deleteButton);
        itemElement.appendChild(nameElement);
        itemElement.appendChild(actionsElement);
        listElement.appendChild(itemElement);
      });
    } else {
      const emptyElement = document.createElement('div');
      emptyElement.className = 'saved-cookie-item';
      emptyElement.textContent = '暂无保存的Cookie集';
      listElement.appendChild(emptyElement);
    }
  } catch (error) {
    showMessage(`刷新Cookie集列表失败: ${error.message}`, false);
  }
}

/**
 * 按名称一键提取Cookie并复制到剪贴板
 * 格式：name:value，每行一个
 */
async function copyTokensByName() {
  const keysInput = document.getElementById('token-keys').value.trim();
  const cookiesJson = document.getElementById('cookies-json').value.trim();

  if (!keysInput) {
    showMessage('请输入要复制的Cookie名称', false);
    return;
  }

  if (!cookiesJson) {
    showMessage('请先提取或加载Cookie数据', false);
    return;
  }

  const keys = keysInput
    .split(',')
    .map(key => key.trim())
    .filter(key => key);

  if (keys.length === 0) {
    showMessage('请输入要复制的Cookie名称', false);
    return;
  }

  try {
    const cookies = JSON.parse(cookiesJson);

    if (!Array.isArray(cookies)) {
      showMessage('Cookie数据格式无效，请确保是数组格式', false);
      return;
    }

    const lines = [];
    const missing = [];

    keys.forEach(key => {
      const cookie = cookies.find(item => item && item.name === key);
      if (cookie) {
        lines.push(`${cookie.name}:${cookie.value || ''}`);
      } else {
        missing.push(key);
      }
    });

    if (lines.length === 0) {
      showMessage(`未找到Cookie: ${keys.join(', ')}`, false);
      return;
    }

    await navigator.clipboard.writeText(lines.join('\n'));

    let message = `已复制 ${lines.length} 个Token`;
    if (missing.length > 0) {
      message += `，未找到: ${missing.join(', ')}`;
    }
    showMessage(message, missing.length === 0);
  } catch (error) {
    showMessage(`解析Cookie失败: ${error.message}`, false);
  }
}

/**
 * 一键复制JSON格式Cookie数据到剪贴板
 */
async function copyJson() {
  const cookiesJson = document.getElementById('cookies-json').value.trim();

  if (!cookiesJson) {
    showMessage('暂无Cookie数据，请先提取或加载', false);
    return;
  }

  try {
    const parsed = JSON.parse(cookiesJson);
    await navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
    showMessage('已复制JSON到剪贴板');
  } catch (error) {
    await navigator.clipboard.writeText(cookiesJson);
    showMessage('已复制JSON到剪贴板');
  }
}

/**
 * 从JSON文本更新表格视图
 */
function updateTableFromJson() {
  const jsonText = document.getElementById('cookies-json').value.trim();
  const tableBody = document.getElementById('cookies-table-body');

  hideAppTooltip();
  // 清空表格内容
  tableBody.innerHTML = '';
  
  if (!jsonText) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 7;
    emptyCell.textContent = '暂无Cookie数据';
    emptyCell.style.textAlign = 'center';
    emptyRow.appendChild(emptyCell);
    tableBody.appendChild(emptyRow);
    return;
  }
  
  try {
    const cookies = JSON.parse(jsonText);
    
    // 检查是否是数组
    if (!Array.isArray(cookies)) {
      const errorRow = document.createElement('tr');
      const errorCell = document.createElement('td');
      errorCell.colSpan = 8;  // 增加了一列，所以colspan也增加
      errorCell.textContent = '无效的Cookie数据格式，请确保是数组格式';
      errorCell.style.textAlign = 'center';
      errorCell.style.color = '#c62828';
      errorRow.appendChild(errorCell);
      tableBody.appendChild(errorRow);
      return;
    }
    
    // 如果没有Cookie数据
    if (cookies.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 8;  // 增加了一列，所以colspan也增加
      emptyCell.textContent = '暂无Cookie数据';
      emptyCell.style.textAlign = 'center';
      emptyRow.appendChild(emptyCell);
      tableBody.appendChild(emptyRow);
      return;
    }
    
    // 遍历Cookie数组，创建表格行
    cookies.forEach((cookie, index) => {
      const row = document.createElement('tr');
      row.dataset.cookieIndex = index;
      
      // 创建勾选框单元格
      const checkboxCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'cookie-checkbox';
      checkbox.id = `cookie-${index}`;
      
      // 默认勾选name为access_token和refresh_token的cookie
      if (cookie.name === 'access_token' || cookie.name === 'refresh_token') {
        checkbox.checked = true;
      }
      
      checkboxCell.appendChild(checkbox);
      
      // 创建各列单元格
      const nameCell = createTableCell(cookie.name || '', false, true);
      const valueCell = createTableCell(cookie.value || '', true, true);
      const domainCell = createTableCell(cookie.domain || '');
      const pathCell = createTableCell(cookie.path || '');
      const expirationCell = createTableCell(formatExpirationDate(cookie.expirationDate));
      const secureCell = createTableCell(cookie.secure ? '✓' : '');
      const httpOnlyCell = createTableCell(cookie.httpOnly ? '✓' : '');
      
      // 添加单元格到行
      row.appendChild(checkboxCell);
      row.appendChild(nameCell);
      row.appendChild(valueCell);
      row.appendChild(domainCell);
      row.appendChild(pathCell);
      row.appendChild(expirationCell);
      row.appendChild(secureCell);
      row.appendChild(httpOnlyCell);
      
      // 添加行到表格
      tableBody.appendChild(row);
    });
  } catch (error) {
    const errorRow = document.createElement('tr');
    const errorCell = document.createElement('td');
    errorCell.colSpan = 8;  // 增加了一列，所以colspan也增加
    errorCell.textContent = `JSON解析错误: ${error.message}`;
    errorCell.style.textAlign = 'center';
    errorCell.style.color = '#c62828';
    errorRow.appendChild(errorCell);
    tableBody.appendChild(errorRow);
  }
}

/**
 * 创建表格单元格
 * @param {string} content - 单元格内容
 * @param {boolean} isValue - 是否为Cookie值（需要特殊处理）
 * @param {boolean} copyable - 是否支持点击复制
 * @returns {HTMLElement} - td元素
 */
function createTableCell(content, isValue = false, copyable = false) {
  const cell = document.createElement('td');
  const text = typeof content === 'string' ? content : String(content ?? '');
  cell.textContent = text;

  if (text) {
    if (copyable) {
      cell.classList.add('copyable');
      cell.addEventListener('click', () => copyCellText(cell, text));
    }
    cell.addEventListener('mouseenter', () => {
      showAppTooltip(cell, text, copyable ? '点击复制' : '');
    });
    cell.addEventListener('mouseleave', (event) => {
      handleTooltipLeave(event);
    });
  }

  return cell;
}

// 即时浮动提示
let appTooltipEl = null;
let appTooltipHideTimer = null;
let appTooltipAnchor = null;

function getAppTooltipEl() {
  if (!appTooltipEl) {
    appTooltipEl = document.createElement('div');
    appTooltipEl.className = 'app-tooltip';
    appTooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(appTooltipEl);
  }
  return appTooltipEl;
}

/**
 * 为按钮等绑定即时 tooltip（mouseenter 立刻显示）
 */
function bindInstantTooltip(el) {
  if (!el || el.__tooltipBound) return;
  el.__tooltipBound = true;
  if (el.title) el.removeAttribute('title');

  el.addEventListener('mouseenter', () => {
    clearTimeout(appTooltipHideTimer);
    appTooltipAnchor = el;
    const text = el.getAttribute('data-tooltip') || '';
    if (text) {
      showAppTooltip(el, text, '');
    }
  });
  el.addEventListener('mouseleave', handleTooltipLeave);
  el.addEventListener('mousedown', hideAppTooltip);
}

/**
 * 扩展弹窗里 tooltip 显示会触发伪 mouseleave，这里过滤掉
 */
function handleTooltipLeave(event) {
  const related = event.relatedTarget;
  // 移入气泡本身 / 子元素不关闭
  if (related && appTooltipEl && (related === appTooltipEl || appTooltipEl.contains(related))) {
    return;
  }
  // 刚显示 200ms 内的 leave 多半是伪事件，只排一次延迟隐藏，且鼠标仍在锚点上则取消
  scheduleHideAppTooltip();
}

function showAppTooltip(anchor, text, hint = '') {
  const tooltip = getAppTooltipEl();
  tooltip.textContent = text || '';

  if (hint) {
    const hintEl = document.createElement('span');
    hintEl.className = 'app-tooltip-hint';
    hintEl.textContent = hint;
    tooltip.appendChild(hintEl);
  }

  // 显隐只用 class，不要写行内 opacity/visibility（会盖住 .visible）
  const anchorRect = anchor.getBoundingClientRect();
  tooltip.style.left = `${Math.round(anchorRect.left)}px`;
  tooltip.style.top = `${Math.round(anchorRect.bottom + 8)}px`;
  tooltip.classList.add('visible');
  // 强制布局后再量宽高，避免量到 0
  const w = tooltip.offsetWidth;
  const h = tooltip.offsetHeight;
  positionAppTooltip(tooltip, anchorRect, w, h);
  appTooltipAnchor = anchor;
}

function positionAppTooltip(tooltip, anchorRect, tipWidth, tipHeight) {
  const gap = 8;
  const edge = 8;
  const viewW = document.documentElement.clientWidth || window.innerWidth;
  const viewH = document.documentElement.clientHeight || window.innerHeight;
  const w = tipWidth || tooltip.offsetWidth;
  const h = tipHeight || tooltip.offsetHeight;

  let x = anchorRect.left;
  let y = anchorRect.bottom + gap;

  if (y + h > viewH - edge) {
    y = anchorRect.top - h - gap;
  }
  if (y < edge) {
    y = Math.min(Math.max(edge, anchorRect.top + gap), Math.max(edge, viewH - h - edge));
  }

  const maxX = Math.max(edge, viewW - w - edge);
  if (x > maxX) x = maxX;
  if (x < edge) x = edge;

  tooltip.style.left = `${Math.round(x)}px`;
  tooltip.style.top = `${Math.round(y)}px`;
}

function scheduleHideAppTooltip() {
  clearTimeout(appTooltipHideTimer);
  appTooltipHideTimer = setTimeout(() => {
    // 鼠标仍在锚点上则不隐藏（挡住扩展弹窗伪 mouseleave）
    if (appTooltipAnchor && typeof appTooltipAnchor.matches === 'function' && appTooltipAnchor.matches(':hover')) {
      return;
    }
    hideAppTooltip();
  }, 150);
}

function hideAppTooltip() {
  clearTimeout(appTooltipHideTimer);
  appTooltipAnchor = null;
  if (appTooltipEl) {
    appTooltipEl.classList.remove('visible');
  }
}

/**
 * 复制单元格文本到剪贴板，并给出反馈
 * @param {HTMLElement} cell - 被点击的单元格
 * @param {string} text - 要复制的文本
 */
async function copyCellText(cell, text) {
  try {
    await navigator.clipboard.writeText(text);
    cell.classList.add('copied');
    showAppTooltip(cell, text, '已复制');
    showMessage('已复制到剪贴板');
    setTimeout(() => {
      cell.classList.remove('copied');
      hideAppTooltip();
    }, 800);
  } catch (error) {
    showMessage(`复制失败: ${error.message}`, false);
  }
}

/**
 * 格式化过期时间
 * @param {number} timestamp - Unix时间戳
 * @returns {string} - 格式化后的时间字符串
 */
function formatExpirationDate(timestamp) {
  if (!timestamp) {
    return '会话结束';
  }
  
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN');
  } catch (error) {
    return '无效时间';
  }
}