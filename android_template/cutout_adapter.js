/* Flagship Dynamic Island / Punch-Hole / Status Bar & Display-Size Adaptive Engine */
(function initFlagshipCutoutAdapter() {
  if (window.__flagshipCutoutAdapterLoaded) return;
  window.__flagshipCutoutAdapterLoaded = true;

  var PREF_KEY = 'app_cutout_adapter_pref_v1';

  // Fallback profiles derived from flagship hardware display dimensions (in logical dp/CSS px)
  // Used ONLY if native DisplayCutout bounding rects are unavailable or disabled by OS.
  var FLAGSHIP_PROFILES = [
    { re: /\biPhone\b/i, detectFn: 'ios' },
    { re: /(ALN-|ALT-|BRA-|PGT-|CFR-|VOG-|Mate\s*60|Mate\s*70|Mate\s*X|Pura\s*70|Pura\s*80)/i, pos: 'center', width: 92, height: 26, top: 10, status: 44 },
    { re: /(BVL-|PTP-|Magic\s*5\s*Pro|Magic\s*6\s*Pro|Magic\s*7\s*Pro|Magic6\s*Pro|Magic7\s*Pro)/i, pos: 'center', width: 76, height: 24, top: 9, status: 42 },
    { re: /Pixel\s*[789]/i, pos: 'center', width: 26, height: 26, top: 12, status: 45 },
    { re: /(SM-S9[1234]|Galaxy\s*S2[3456])/i, pos: 'center', width: 24, height: 24, top: 9, status: 38 },
    { re: /(2311|2412|250|Xiaomi\s*1[345]|Mi\s*1[345]|Redmi\s*K[678]0|POCO\s*F[567])/i, pos: 'center', width: 25, height: 25, top: 9, status: 40 },
    { re: /(V230|V232|V240|V241|vivo\s*X[12]00|X90|CPH25|CPH26|OnePlus\s*1[123]|Find\s*X[678]|PKB|PJD)/i, pos: 'center', width: 24, height: 24, top: 8, status: 38 }
  ];

  function loadPref() {
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') return obj;
      }
    } catch (e) {}
    return { mode: 'auto', offsetY: 0, spacerExtra: 0 };
  }

  function savePref(p) {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {}
  }

  function clamp(v, minV, maxV) {
    return Math.max(minV, Math.min(maxV, v));
  }

  function probeCssSafeEnv() {
    try {
      var el = document.getElementById('__cutoutEnvProbe');
      if (!el && document.body) {
        el = document.createElement('div');
        el.id = '__cutoutEnvProbe';
        el.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
          'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);' +
          'padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);';
        document.body.appendChild(el);
      }
      if (!el || !window.getComputedStyle) return { top: 0, bottom: 0, left: 0, right: 0 };
      var cs = window.getComputedStyle(el);
      return {
        top: parseFloat(cs.paddingTop) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0,
        right: parseFloat(cs.paddingRight) || 0
      };
    } catch (e) {
      return { top: 0, bottom: 0, left: 0, right: 0 };
    }
  }

  function getNativeMetrics() {
    var m = window.__ANDROID_DISPLAY_METRICS__;
    if ((!m || !m.widthDp) && window.AndroidNativeBridge && typeof window.AndroidNativeBridge.getDisplayMetricsJson === 'function') {
      try {
        m = JSON.parse(window.AndroidNativeBridge.getDisplayMetricsJson() || '{}');
        window.__ANDROID_DISPLAY_METRICS__ = m;
      } catch (e) {}
    }
    return (m && typeof m === 'object') ? m : null;
  }

  function resolveFallbackGeometry(vw, envInsets, nativeM) {
    var modelStr = (nativeM ? ((nativeM.manufacturer || '') + ' ' + (nativeM.brand || '') + ' ' + (nativeM.model || '')) : '') + ' ' + (navigator.userAgent || '');
    for (var i = 0; i < FLAGSHIP_PROFILES.length; i++) {
      var prof = FLAGSHIP_PROFILES[i];
      if (!prof.re.test(modelStr)) continue;
      if (prof.detectFn === 'ios') {
        if (envInsets.top >= 54) {
          // iPhone Dynamic Island (~126pt x 37pt)
          return { source: 'ios-island', hasCutout: true, pos: 'center', width: 126, height: 37, top: 11, bottom: 48, centerY: 29.5, status: Math.max(54, envInsets.top) };
        }
        if (envInsets.top >= 40) {
          // iPhone Notch
          return { source: 'ios-notch', hasCutout: true, pos: 'below', width: 160, height: 32, top: 0, bottom: envInsets.top, centerY: envInsets.top * 0.5, status: envInsets.top };
        }
      } else {
        return {
          source: 'profile-table',
          hasCutout: true,
          pos: prof.pos,
          width: prof.width,
          height: prof.height,
          top: prof.top,
          bottom: prof.top + prof.height,
          centerY: prof.top + prof.height * 0.5,
          status: prof.status
        };
      }
    }

    // Generic heuristic based on CSS safe-area-inset-top & status bar resource height
    var statusEst = Math.max(envInsets.top || 0, (nativeM && (nativeM.safeTopDp || nativeM.statusBarTopDp || nativeM.statusBarResDp)) || 0);
    if (vw >= 640 && statusEst < 28) {
      return { source: 'tablet-flat', hasCutout: false, pos: 'none', width: 0, height: 0, top: 0, bottom: 0, centerY: 18, status: statusEst || 24 };
    }
    if (statusEst >= 44) {
      return { source: 'env-tall', hasCutout: true, pos: 'center', width: 28, height: 26, top: Math.max(8, Math.round(statusEst - 30)), bottom: Math.round(statusEst - 4), centerY: Math.round(statusEst - 17), status: statusEst };
    }
    if (statusEst > 0) {
      return { source: 'env-std', hasCutout: true, pos: 'center', width: 26, height: 24, top: Math.max(6, Math.round((statusEst - 24) * 0.5)), bottom: Math.round((statusEst + 24) * 0.5), centerY: Math.round(statusEst * 0.5), status: statusEst };
    }
    // Browser / desktop fallback with zero OS telemetry: leave comfortable balanced center clearance
    return { source: 'default', hasCutout: vw < 600, pos: vw < 600 ? 'center' : 'none', width: vw < 600 ? 28 : 0, height: 24, top: 8, bottom: 32, centerY: 20, status: 36 };
  }

  function resolveGeometry(vw, envInsets, nativeM, pref) {
    if (pref.mode && pref.mode !== 'auto') {
      if (pref.mode === 'flat') return { source: 'manual', hasCutout: false, pos: 'none', width: 0, height: 0, top: 0, bottom: 0, centerY: 18, status: 28 };
      if (pref.mode === 'left_hole') return { source: 'manual', hasCutout: true, pos: 'left', width: 28, height: 26, top: 9, bottom: 35, centerY: 22, left: 16, right: 44, status: 40 };
      if (pref.mode === 'center_pill') return { source: 'manual', hasCutout: true, pos: 'center', width: 96, height: 28, top: 10, bottom: 38, centerY: 24, status: 44 };
      if (pref.mode === 'below') return { source: 'manual', hasCutout: true, pos: 'below', width: 130, height: 38, top: 10, bottom: 48, centerY: 29, status: 54 };
      return { source: 'manual', hasCutout: true, pos: 'center', width: 28, height: 24, top: 8, bottom: 32, centerY: 20, status: 38 };
    }

    if (nativeM && nativeM.hasCutout && nativeM.cutoutWidthDp > 0) {
      var rel = typeof nativeM.cutoutRelCenterX === 'number' ? nativeM.cutoutRelCenterX : 0.5;
      var pos = 'center';
      if (rel < 0.36) pos = 'left';
      else if (rel > 0.64) pos = 'right';
      return {
        source: 'native-cutout',
        hasCutout: true,
        pos: pos,
        width: nativeM.cutoutWidthDp,
        height: nativeM.cutoutHeightDp,
        top: nativeM.cutoutTopDp,
        bottom: nativeM.cutoutBottomDp,
        left: nativeM.cutoutLeftDp,
        right: nativeM.cutoutRightDp,
        centerX: nativeM.cutoutCenterXDp,
        centerY: nativeM.cutoutCenterYDp,
        relCenterX: rel,
        status: Math.max(nativeM.safeTopDp || 0, nativeM.statusBarTopDp || 0, nativeM.cutoutBottomDp + 4)
      };
    }

    return resolveFallbackGeometry(vw, envInsets, nativeM);
  }

  function applyAdaptiveCutoutLayout(incomingNative) {
    if (incomingNative && typeof incomingNative === 'object') {
      window.__ANDROID_DISPLAY_METRICS__ = incomingNative;
    }
    var nativeM = getNativeMetrics();
    var envInsets = probeCssSafeEnv();
    var pref = loadPref();

    var vw = Math.max(280, Math.round(window.innerWidth || (nativeM && nativeM.widthDp) || 360));
    var vvTop = 0;
    if (window.visualViewport && typeof window.visualViewport.offsetTop === 'number') {
      vvTop = Math.max(0, Math.round(window.visualViewport.offsetTop));
    }

    var geom = resolveGeometry(vw, envInsets, nativeM, pref);
    var fontScale = (nativeM && nativeM.fontScale) ? nativeM.fontScale : 1;

    // Responsive capsule container width across narrow displays, enlarged Display Size, and foldables/tablets
    var sideMargin = vw <= 345 ? 10 : (vw >= 640 ? 32 : 16);
    var maxBarW = vw >= 720 ? 640 : (vw >= 560 ? 540 : 492);
    var barWidth = Math.min(vw - sideMargin, maxBarW);
    var barLeft = (vw - barWidth) * 0.5;

    var barH = clamp(Math.round(Math.max(34, (geom.height || 24) + 12)), 34, 42);
    if (vw <= 340) barH = 34;

    var barTop = 3;
    var spacerW = 0;
    var padLeft = vw <= 355 ? 9 : 12;
    var padRight = vw <= 355 ? 9 : 12;
    var belowMode = false;

    if (!geom.hasCutout || geom.pos === 'none') {
      barTop = Math.max(4, Math.round((geom.status > 24 ? geom.status - barH : 6)));
      barTop = clamp(barTop, 4, 16);
      spacerW = 10;
    } else if (geom.pos === 'below') {
      belowMode = true;
      barTop = clamp(Math.round((geom.bottom || geom.status || 44) + 4), 38, 66);
      spacerW = 8;
    } else if (geom.pos === 'left') {
      barTop = clamp(Math.round((geom.centerY || 20) - barH * 0.5), 2, 22);
      var holeRight = (typeof geom.right === 'number' && geom.right > 0) ? geom.right : ((geom.left || 16) + geom.width);
      padLeft = clamp(Math.round(Math.max(padLeft, holeRight - barLeft + 10)), 12, Math.round(barWidth * 0.34));
      spacerW = 8;
    } else if (geom.pos === 'right') {
      barTop = clamp(Math.round((geom.centerY || 20) - barH * 0.5), 2, 22);
      var holeLeft = (typeof geom.left === 'number' && geom.left > 0) ? geom.left : (vw - 16 - geom.width);
      var barRight = barLeft + barWidth;
      padRight = clamp(Math.round(Math.max(padRight, barRight - holeLeft + 10)), 12, Math.round(barWidth * 0.34));
      spacerW = 8;
    } else {
      // Centered punch-hole / wide pill / Dynamic Island
      spacerW = clamp(Math.round(geom.width + 26 + (pref.spacerExtra || 0)), 52, 160);
      var lobeBudget = (barWidth - spacerW - padLeft - padRight) * 0.5;
      // Drop below wide Dynamic Island or narrowed Display-Size screen if flanking space would crush clock/battery telemetry
      if (lobeBudget < 114 || geom.width >= barWidth * 0.36 || (geom.top || 0) >= 16) {
        belowMode = true;
        barTop = clamp(Math.round(Math.max(geom.bottom || 0, geom.status || 44) + 4), 40, 68);
        spacerW = 8;
      } else {
        barTop = clamp(Math.round((geom.centerY || 19) - barH * 0.5), 2, 24);
      }
    }

    barTop += Math.round(pref.offsetY || 0) + vvTop;
    barTop = Math.max(2 + vvTop, barTop);

    var safeTopFloor = Math.max(barTop - vvTop + barH, geom.status || 0);
    var shieldH = Math.round(safeTopFloor + 4);
    var reserveTop = Math.round(safeTopFloor + 8);
    var stickyTop = Math.round(safeTopFloor + 6);

    var safeBottom = Math.round(Math.max(
      envInsets.bottom || 0,
      (nativeM && Math.max(nativeM.safeBottomDp || 0, nativeM.navBottomDp || 0)) || 0
    ));

    var bar = document.getElementById('immersiveStatusBar');
    var isLobbyBar = !!(bar && bar.classList && (bar.classList.contains('lobby-adaptive-status-bar') || bar.classList.contains('lobby-trilogy-status-bar')));
    var baseFloor = isLobbyBar ? 37 : 39;
    var extraTop = Math.max(0, Math.round(safeTopFloor - baseFloor));
    var barBottom = Math.round(safeTopFloor);

    // Decide compact text mode for narrow screens (< 365dp), large Display Size, or large fontScale
    var lobeW = (barWidth - spacerW - padLeft - padRight) * 0.5;
    var isCompact = vw <= 360 || fontScale >= 1.15 || (!belowMode && geom.pos === 'center' && lobeW < 118);

    var rootStyle = document.documentElement.style;
    rootStyle.setProperty('--isb-fixed-top', barTop + 'px');
    rootStyle.setProperty('--isb-height', barH + 'px');
    rootStyle.setProperty('--isb-max-width', maxBarW + 'px');
    rootStyle.setProperty('--isb-bar-width', barWidth + 'px');
    rootStyle.setProperty('--isb-spacer-width', spacerW + 'px');
    rootStyle.setProperty('--isb-lobe-max', belowMode || geom.pos !== 'center' ? '48%' : ('calc(50% - ' + Math.ceil(spacerW * 0.5) + 'px)'));
    rootStyle.setProperty('--isb-pad-left', padLeft + 'px');
    rootStyle.setProperty('--isb-pad-right', padRight + 'px');
    rootStyle.setProperty('--isb-shield-height', shieldH + 'px');
    rootStyle.setProperty('--isb-reserve-top', reserveTop + 'px');
    rootStyle.setProperty('--isb-sticky-top', stickyTop + 'px');
    rootStyle.setProperty('--isb-extra-top', extraTop + 'px');
    rootStyle.setProperty('--isb-bar-bottom', barBottom + 'px');
    rootStyle.setProperty('--isb-safe-bottom', safeBottom + 'px');

    if (bar) {
      bar.style.setProperty('--isb-fixed-top', barTop + 'px');
      bar.classList.toggle('isb-compact', !!isCompact);
      bar.classList.toggle('isb-below-cutout', !!belowMode);
      bar.classList.toggle('isb-side-cutout', geom.pos === 'left' || geom.pos === 'right');
    }
    if (document.body) {
      document.body.classList.toggle('has-safe-bottom-nav', safeBottom > 0);
    }

    window.__LAST_CUTOUT_LAYOUT__ = {
      source: geom.source,
      pos: geom.pos,
      belowMode: belowMode,
      isCompact: isCompact,
      vw: vw,
      barWidth: barWidth,
      barTop: barTop,
      barH: barH,
      spacerW: spacerW,
      padLeft: padLeft,
      padRight: padRight,
      reserveTop: reserveTop,
      extraTop: extraTop,
      barBottom: barBottom,
      safeBottom: safeBottom
    };
  }

  window.__applyAndroidDisplayMetrics = applyAdaptiveCutoutLayout;
  window.__recalcCutoutLayout = function() { applyAdaptiveCutoutLayout(null); };
  window.__getCutoutStatusSummary = function() {
    var nativeM = getNativeMetrics();
    var L = window.__LAST_CUTOUT_LAYOUT__ || {};
    var parts = [
      '視口 ' + (L.vw || Math.round(window.innerWidth || 360)) + 'dp',
      '來源 ' + (L.source || 'auto'),
      L.belowMode ? '島下避讓' : (L.pos === 'left' || L.pos === 'right' ? '側邊挖孔避讓' : '居中淨空 ' + (L.spacerW || 52) + 'px')
    ];
    if (nativeM && nativeM.hasCutout && nativeM.cutoutWidthDp) {
      parts.push('物理孔 ' + Math.round(nativeM.cutoutWidthDp) + '×' + Math.round(nativeM.cutoutHeightDp) + 'dp');
    }
    if (nativeM && nativeM.fontScale) {
      parts.push('系統字縮放 ' + Number(nativeM.fontScale).toFixed(2) + 'x');
    }
    return parts.join(' · ');
  };
  window.__syncCutoutSettingsUi = function() {
    var pref = loadPref();
    var sel = document.getElementById('cutoutModeSelect');
    if (sel) sel.value = pref.mode || 'auto';
    var rngY = document.getElementById('cutoutOffsetRange');
    if (rngY) rngY.value = String(pref.offsetY || 0);
    var lblY = document.getElementById('cutoutOffsetVal');
    if (lblY) lblY.textContent = ((pref.offsetY || 0) >= 0 ? '+' : '') + (pref.offsetY || 0) + 'px';
    var rngS = document.getElementById('cutoutSpacerRange');
    if (rngS) rngS.value = String(pref.spacerExtra || 0);
    var lblS = document.getElementById('cutoutSpacerVal');
    if (lblS) lblS.textContent = ((pref.spacerExtra || 0) >= 0 ? '+' : '') + (pref.spacerExtra || 0) + 'px';
    var info = document.getElementById('cutoutLiveTelemetry');
    if (info && typeof window.__getCutoutStatusSummary === 'function') {
      info.textContent = window.__getCutoutStatusSummary();
    }
  };
  window.__setCutoutAdapterPref = function(nextPref) {
    var cur = loadPref();
    var merged = Object.assign({}, cur, nextPref || {});
    savePref(merged);
    applyAdaptiveCutoutLayout(null);
    if (typeof window.__syncCutoutSettingsUi === 'function') {
      window.__syncCutoutSettingsUi();
    }
    return merged;
  };
  window.__getCutoutAdapterPref = loadPref;

  function boot() {
    applyAdaptiveCutoutLayout(null);
    setTimeout(function() { applyAdaptiveCutoutLayout(null); }, 120);
    setTimeout(function() { applyAdaptiveCutoutLayout(null); }, 450);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener('resize', function() { applyAdaptiveCutoutLayout(null); }, { passive: true });
  window.addEventListener('orientationchange', function() {
    setTimeout(function() { applyAdaptiveCutoutLayout(null); }, 160);
  }, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() { applyAdaptiveCutoutLayout(null); }, { passive: true });
    window.visualViewport.addEventListener('scroll', function() { applyAdaptiveCutoutLayout(null); }, { passive: true });
  }
})();
