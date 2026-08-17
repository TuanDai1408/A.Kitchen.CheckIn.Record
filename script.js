/**
 * ============================================================
 * ADMIN CHECK-IN - A.KITCHEN (Frontend)
 * Gọi API qua fetch(), vẽ chart bằng Chart.js
 * ============================================================
 */

// ===== CẤU HÌNH API =====
// ← Điền URL Web App sau khi deploy Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbxXJZmK7H2jRX-v4XhoyIDG9gve9WQGgMIhG4n0kP1GI7UA6bKYOzLwoiOcdgx-W7lF/exec';
const API_TOKEN = 'TRANTUANDAISIBAFOOD';

// ===== API HELPER =====
async function callAPI(action) {
  try {
    const url = `${API_URL}?action=${encodeURIComponent(action)}&token=${encodeURIComponent(API_TOKEN)}`;
    const response = await fetch(url);
    const json = await response.json();
    if (json.status === 'error') {
      throw new Error(json.message || 'API error');
    }
    return json.data;
  } catch (err) {
    console.log('API call failed:', action, err);
    throw err;
  }
}

async function callPostAPI(action, payload) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: action,
        token: API_TOKEN,
        payload: payload
      })
    });
    const json = await response.json();
    if (json.status === 'error') {
      throw new Error(json.message || 'API error');
    }
    return json.data;
  } catch (err) {
    console.log('POST API call failed:', action, err);
    throw err;
  }
}

// ===== GLOBAL STATE =====
var ALL = [];        // toàn bộ dữ liệu
var VIEW = [];       // dữ liệu sau khi lọc
var REFRESH_MS = 15000;
var timer = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  loadLogo();
  loadData();
  loadReport();
  timer = setInterval(function(){
    loadData();
    if(CURRENT_TAB==='report') loadReport();
  }, REFRESH_MS);

  // realtime filter
  ['fSearch','fDept','fFrom','fTo'].forEach(function(id){
    document.getElementById(id).addEventListener('input', applyFilter);
  });
});

// Nạp logo nếu có cấu hình
async function loadLogo() {
  try {
    const result = await callAPI('getLogoUrl');
    if (result && result.logoUrl) {
      document.getElementById('logoBox').innerHTML = '<img src="' + result.logoUrl + '">';
    }
  } catch (err) {
    console.log('loadLogo error:', err);
  }
}

async function loadData(manual) {
  if (manual) toast('Đang làm mới...');
  try {
    const res = await callAPI('getCheckinData');
    onData(res);
  } catch (err) {
    toast('Lỗi: ' + err.message);
    console.log('loadData error:', err);
  }
}

function onData(res) {
  if (!res.ok) { toast(res.message); return; }
  ALL = res.rows || [];
  document.getElementById('lastUpdate').textContent = res.updatedAt || '';
  // đổ danh sách phòng ban vào filter (giữ lựa chọn hiện tại)
  var sel = document.getElementById('fDept');
  var cur = sel.value;
  sel.innerHTML = '<option value="">Tất cả</option>';
  (res.phongBanList||[]).forEach(function(p){
    var o=document.createElement('option'); o.value=p; o.textContent=p; sel.appendChild(o);
  });
  sel.value = cur;
  applyFilter();
}

function applyFilter() {
  var q  = document.getElementById('fSearch').value.toLowerCase().trim();
  var pb = document.getElementById('fDept').value;
  var from = document.getElementById('fFrom').value; // yyyy-mm-dd
  var to   = document.getElementById('fTo').value;

  VIEW = ALL.filter(function(r){
    if(pb && r.phongBan !== pb) return false;
    if(q){
      var hay = (r.maGV+' '+r.hoTen).toLowerCase();
      if(hay.indexOf(q) < 0) return false;
    }
    if(from && r.ngay && r.ngay < from) return false;
    if(to   && r.ngay && r.ngay > to)   return false;
    return true;
  });
  render();
  updateStats();
}

function render() {
  var tb = document.getElementById('tbody');
  if(!VIEW.length){
    tb.innerHTML = '<tr><td colspan="5" class="empty">Không có dữ liệu phù hợp</td></tr>';
    document.getElementById('footInfo').textContent = 'Hiển thị 0 dòng';
    return;
  }
  var html = '';
  VIEW.forEach(function(r,i){
    html += '<tr>'
      + '<td>'+(i+1)+'</td>'
      + '<td class="code">'+esc(r.maGV)+'</td>'
      + '<td>'+esc(r.hoTen)+'</td>'
      + '<td>'+(r.phongBan?'<span class="badge">'+esc(r.phongBan)+'</span>':'')+'</td>'
      + '<td>'+esc(r.thoiGian)+'</td>'
      + '</tr>';
  });
  tb.innerHTML = html;
  document.getElementById('footInfo').textContent = 'Hiển thị '+VIEW.length+' / '+ALL.length+' dòng';
}

function updateStats() {
  var today = new Date();
  var y=today.getFullYear(), m=('0'+(today.getMonth()+1)).slice(-2), d=('0'+today.getDate()).slice(-2);
  var todayStr = y+'-'+m+'-'+d;
  var todayCount = ALL.filter(function(r){return r.ngay===todayStr;}).length;
  var people = {}, dept = {};
  ALL.forEach(function(r){ if(r.maGV) people[r.maGV]=1; if(r.phongBan) dept[r.phongBan]=1; });
  document.getElementById('stTotal').textContent  = ALL.length;
  document.getElementById('stToday').textContent  = todayCount;
  document.getElementById('stPeople').textContent = Object.keys(people).length;
  document.getElementById('stDept').textContent   = Object.keys(dept).length;
}

function resetFilter() {
  document.getElementById('fSearch').value='';
  document.getElementById('fDept').value='';
  document.getElementById('fFrom').value='';
  document.getElementById('fTo').value='';
  applyFilter();
}

async function doExport() {
  if(!VIEW.length){ toast('Không có dữ liệu để xuất'); return; }
  var btn = document.getElementById('btnExport');
  var box = document.getElementById('dlBox');
  box.style.display = 'none';
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Đang tạo file...';

  try {
    const res = await callPostAPI('exportExcel', VIEW);
    btn.disabled=false; btn.innerHTML='⬇ Xuất Excel';
    if(res && res.ok){
      document.getElementById('dlLink').href = res.downloadUrl;
      document.getElementById('dlName').textContent = res.name;
      box.style.display = 'flex';
      // Đổ dữ liệu vào modal và hiển thị
      document.getElementById('modalFileName').textContent = res.name;
      document.getElementById('modalDlLink').href = res.downloadUrl;
      document.getElementById('dlModal').classList.add('show');
    } else { toast('Xuất thất bại'); }
  } catch (err) {
    btn.disabled=false; btn.innerHTML='⬇ Xuất Excel';
    toast('Lỗi xuất: ' + err.message);
    console.log('doExport error:', err);
  }
}

function closeModal() {
  document.getElementById('dlModal').classList.remove('show');
}

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

var toastTimer;
function toast(msg){
  var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(function(){t.classList.remove('show');},2500);
}

/* ==================== TAB & BÁO CÁO ==================== */
var CURRENT_TAB = 'report';
var CHARTS = {};        // giữ instance chart để hủy khi vẽ lại
var reportLoaded = false;

// Bảng màu theo brand
var RED='#B01116', RED_L='#e8474d', GOLD='#d4a537', GREEN='#1d6f42';
var PALETTE = ['#B01116','#d4a537','#1d6f42','#e8474d','#7d0c10','#e0a800',
               '#2b8a5a','#c65a5f','#a8842a','#5c9e7a','#8a1f24','#d98c2b'];

function switchTab(tab) {
  CURRENT_TAB = tab;
  document.getElementById('tabBtnData').classList.toggle('active', tab==='data');
  document.getElementById('tabBtnReport').classList.toggle('active', tab==='report');
  document.getElementById('panelData').classList.toggle('active', tab==='data');
  document.getElementById('panelReport').classList.toggle('active', tab==='report');
  if(tab==='report') loadReport();
}

async function loadReport() {
  try {
    const res = await callAPI('getReportData');
    onReport(res);
  } catch (err) {
    toast('Lỗi báo cáo: ' + err.message);
    console.log('loadReport error:', err);
  }
}

function onReport(res) {
  if(!res || !res.ok){ toast((res&&res.message)||'Không tải được báo cáo'); return; }
  if(res.empty){ toast('Chưa có dữ liệu để thống kê'); return; }
  reportLoaded = true;
  var s = res.summary || {};
  document.getElementById('rTotal').textContent = s.totalCheckin||0;
  document.getElementById('rAvg').textContent   = s.avgPerDay||0;
  document.getElementById('rQty').textContent   = s.totalQty||0;
  document.getElementById('rProd').textContent  = s.uniqueProduct||0;
  document.getElementById('rMismatch').textContent = s.mismatchDays||0;
  document.getElementById('rGap').textContent      = s.totalGap||0;

  // Highlight thẻ stat khi có lệch
  var hasMismatch = (s.mismatchDays||0) > 0;
  document.getElementById('statMismatch').classList.toggle('warn', hasMismatch);
  document.getElementById('statGap').classList.toggle('warn', hasMismatch);

  // Chart so sánh trọng tâm
  drawCompare('chCompare', res.compareByDate);

  drawLine('chDate', res.checkinByDate, 'Lượt check-in', RED);
  drawBar('chDept', res.checkinByDept, 'Lượt', RED, true);
  drawBar('chHour', res.checkinByHour, 'Lượt', GOLD, false);
  drawBar('chWeekday', res.checkinByWeekday, 'Lượt', GREEN, false);
  drawBar('chTop', res.topTeachers, 'Lượt', RED_L, true);
  drawDoughnut('chProduct', (res.productByName||[]).slice(0,8));
  drawBar('chProdDate', res.productByDate, 'Suất ăn', GREEN, false);
}

function drawCompare(id, data) {
  destroy(id);
  var ctx = document.getElementById(id).getContext('2d');
  var lbls = (data||[]).map(function(r){return r.label;});
  var ci   = (data||[]).map(function(r){return r.checkin;});
  var sold = (data||[]).map(function(r){return r.sold;});
  // Tô màu cột "bán ra": ngày lệch -> vàng cảnh báo, khớp -> xanh
  var soldColors = (data||[]).map(function(r){ return r.mismatch ? GOLD : GREEN; });
  var ciColors   = (data||[]).map(function(r){ return r.mismatch ? RED_L : RED; });

  CHARTS[id] = new Chart(ctx, {
    type:'bar',
    data:{ labels:lbls, datasets:[
      { label:'Check-in (giảng viên)', data:ci,   backgroundColor:ciColors,   borderRadius:5, maxBarThickness:40 },
      { label:'Suất ăn bán ra',        data:sold, backgroundColor:soldColors, borderRadius:5, maxBarThickness:40 }
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'top', labels:{ boxWidth:14, font:{size:12}, usePointStyle:true } },
        tooltip:{ callbacks:{ afterBody:function(items){
          var i = items[0].dataIndex; var r = (data||[])[i];
          if(!r) return '';
          if(r.gap===0) return '✓ Khớp số liệu';
          return (r.gap>0 ? '⚠ Bán dư ' + r.gap + ' suất' : '⚠ Thiếu ' + Math.abs(r.gap) + ' suất');
        }}}
      },
      scales:{
        x:{ grid:{ display:false }, ticks:{ font:{size:11}, maxRotation:0, autoSkip:true } },
        y:{ grid:{ color:'#f0f0f0' }, beginAtZero:true, ticks:{ font:{size:11}, precision:0 } }
      }
    }
  });
}

function labels(arr){ return (arr||[]).map(function(x){return x.label;}); }
function vals(arr){ return (arr||[]).map(function(x){return x.value;}); }

function destroy(id){ if(CHARTS[id]){ CHARTS[id].destroy(); delete CHARTS[id]; } }

function drawLine(id, data, label, color) {
  destroy(id);
  var ctx = document.getElementById(id).getContext('2d');
  CHARTS[id] = new Chart(ctx, {
    type:'line',
    data:{ labels:labels(data), datasets:[{
      label:label, data:vals(data), borderColor:color, backgroundColor:'rgba(176,17,22,.12)',
      fill:true, tension:.3, pointRadius:3, pointBackgroundColor:color, borderWidth:2
    }]},
    options:baseOpts(false)
  });
}

function drawBar(id, data, label, color, horizontal) {
  destroy(id);
  var ctx = document.getElementById(id).getContext('2d');
  CHARTS[id] = new Chart(ctx, {
    type:'bar',
    data:{ labels:labels(data), datasets:[{
      label:label, data:vals(data), backgroundColor:color, borderRadius:6, maxBarThickness:46
    }]},
    options:baseOpts(horizontal)
  });
}

function drawDoughnut(id, data) {
  destroy(id);
  var ctx = document.getElementById(id).getContext('2d');
  CHARTS[id] = new Chart(ctx, {
    type:'doughnut',
    data:{ labels:labels(data), datasets:[{
      data:vals(data), backgroundColor:PALETTE, borderWidth:2, borderColor:'#fff'
    }]},
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'55%',
      plugins:{ legend:{ position:'right', labels:{ boxWidth:14, font:{size:11} } } }
    }
  });
}

function baseOpts(horizontal) {
  return {
    responsive:true, maintainAspectRatio:false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins:{ legend:{ display:false } },
    scales:{
      x:{ grid:{ display:!horizontal, color:'#f0f0f0' }, ticks:{ font:{size:11}, autoSkip:true, maxRotation:0 } },
      y:{ grid:{ display:horizontal, color:'#f0f0f0' }, beginAtZero:true, ticks:{ font:{size:11}, precision:0 } }
    }
  };
}
