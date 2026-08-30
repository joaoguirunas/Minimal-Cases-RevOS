/**
 * RevOS LP Pro — Embed Script
 * Uso:
 *   Script inline:  <div id="lp-form-{id}"></div><script src="/embed.js" data-form-id="{id}" async></script>
 *   Widget FAB:     <script>window.lpProConfig = { formId, position, buttonColor, ... };</script><script src="/embed.js" async></script>
 */
(function () {
  'use strict';

  var BASE_URL = (function () {
    // Prefer the script's own origin so embeds hosted externally point back to the app
    var scripts = document.querySelectorAll('script[src*="embed.js"]');
    if (scripts.length) {
      try {
        var url = new URL(scripts[scripts.length - 1].src);
        return url.origin;
      } catch (_) {}
    }
    return window.location.origin;
  })();

  // ─── helpers ──────────────────────────────────────────────────────────────

  function formUrl(formId) {
    return BASE_URL + '/f/' + encodeURIComponent(formId) + '?embed=1';
  }

  function iframeStyles(extra) {
    var base = 'border:none;background:transparent;width:100%;height:100%;min-height:600px;display:block;';
    return base + (extra || '');
  }

  // ─── Mode A: Script tag with data-form-id ────────────────────────────────

  function initInline() {
    var scripts = document.querySelectorAll('script[data-form-id]');
    for (var i = 0; i < scripts.length; i++) {
      var tag = scripts[i];
      var fid = tag.getAttribute('data-form-id');
      if (!fid) continue;

      // Try explicit container div first, then fall back to inserting after the script tag
      var container = document.getElementById('lp-form-' + fid);
      var iframe = document.createElement('iframe');
      iframe.src = formUrl(fid);
      iframe.setAttribute('style', iframeStyles());
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('allow', 'clipboard-write');
      iframe.title = 'Formulário';

      if (container) {
        container.style.cssText = 'width:100%;overflow:hidden;';
        container.appendChild(iframe);
      } else {
        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'width:100%;overflow:hidden;';
        wrapper.appendChild(iframe);
        tag.parentNode.insertBefore(wrapper, tag.nextSibling);
      }
    }
  }

  // ─── Mode B: window.lpProConfig floating widget ──────────────────────────

  var SIZES = { sm: '48px', md: '56px', lg: '64px' };
  var POSITIONS = {
    'bottom-right': 'bottom:24px;right:24px;',
    'bottom-left':  'bottom:24px;left:24px;',
    'top-right':    'top:24px;right:24px;',
    'top-left':     'top:24px;left:24px;',
  };

  function initWidget(cfg) {
    var fid = cfg.formId;
    if (!fid) return;

    var position  = cfg.position     || 'bottom-right';
    var color     = cfg.buttonColor  || '#4f46e5';
    var shape     = cfg.buttonShape  || 'round';
    var size      = cfg.buttonSize   || 'md';
    var shadow    = cfg.buttonShadow !== false;
    var label     = cfg.buttonLabel  || '';
    var icon      = cfg.buttonIcon   || '';
    var isWhatsapp = cfg.type === 'whatsapp' && cfg.whatsapp;

    var btnSize = SIZES[size] || SIZES['md'];
    var posCSS  = POSITIONS[position] || POSITIONS['bottom-right'];
    var radius  = shape === 'pill' ? '9999px' : '50%';
    var shadowCSS = shadow ? 'box-shadow:0 4px 16px rgba(0,0,0,.25);' : '';

    // Panel open state
    var open = false;

    // ── FAB button ──
    var btn = document.createElement('button');
    var btnCSS = [
      'position:fixed;z-index:2147483647;',
      posCSS,
      'width:' + (shape === 'pill' && label ? 'auto' : btnSize) + ';',
      'height:' + btnSize + ';',
      'border-radius:' + radius + ';',
      'background:' + color + ';',
      'color:#fff;',
      'border:none;',
      'cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;gap:8px;',
      'padding:' + (shape === 'pill' && label ? '0 20px' : '0') + ';',
      'font-family:system-ui,sans-serif;font-size:14px;font-weight:600;',
      shadowCSS,
      'transition:transform .15s,opacity .15s;',
    ].join('');
    btn.setAttribute('style', btnCSS);
    btn.setAttribute('aria-label', label || 'Abrir formulário');

    var iconContent = icon || (isWhatsapp
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.309A9.944 9.944 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.952 7.952 0 0 1-4.076-1.124l-.292-.173-3.023.793.807-2.944-.19-.302A7.952 7.952 0 0 1 4 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>');

    btn.innerHTML = iconContent + (label ? '<span>' + label + '</span>' : '');

    // ── Panel / overlay ──
    var panel = document.createElement('div');

    // Determine panel position relative to FAB
    var isRight  = position.indexOf('right') !== -1;
    var isBottom = position.indexOf('bottom') !== -1;
    var panelPos = isRight  ? 'right:24px;' : 'left:24px;';
    panelPos    += isBottom ? 'bottom:90px;' : 'top:90px;';

    panel.setAttribute('style', [
      'position:fixed;z-index:2147483646;',
      panelPos,
      'width:360px;max-width:calc(100vw - 48px);',
      'height:560px;max-height:calc(100vh - 120px);',
      'border-radius:12px;overflow:hidden;',
      'box-shadow:0 8px 32px rgba(0,0,0,.2);',
      'background:#fff;',
      'display:none;',
      'transition:opacity .2s,transform .2s;',
      'opacity:0;transform:translateY(8px);',
    ].join(''));

    // Close button inside panel
    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('style', [
      'position:absolute;top:8px;right:8px;z-index:1;',
      'width:28px;height:28px;border-radius:50%;',
      'background:rgba(0,0,0,.08);border:none;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'font-size:16px;line-height:1;color:#333;',
    ].join(''));
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Fechar');

    var panelIframe = document.createElement('iframe');
    panelIframe.setAttribute('style', 'width:100%;height:100%;border:none;background:transparent;display:block;');
    panelIframe.setAttribute('loading', 'lazy');
    panelIframe.setAttribute('allow', 'clipboard-write');
    panelIframe.title = 'Formulário';
    // Load iframe lazily on first open
    var iframeLoaded = false;

    panel.appendChild(closeBtn);
    panel.appendChild(panelIframe);

    function openPanel() {
      if (!iframeLoaded) {
        if (isWhatsapp) {
          var wa = cfg.whatsapp.replace(/\D/g, '');
          window.open('https://wa.me/' + wa, '_blank');
          return;
        }
        panelIframe.src = formUrl(fid);
        iframeLoaded = true;
      }
      open = true;
      panel.style.display = 'block';
      // Force reflow for transition
      void panel.offsetHeight;
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
      btn.style.transform = 'scale(.92)';
    }

    function closePanel() {
      open = false;
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(8px)';
      btn.style.transform = '';
      setTimeout(function () {
        if (!open) panel.style.display = 'none';
      }, 210);
    }

    btn.addEventListener('click', function () {
      if (open) closePanel(); else openPanel();
    });
    closeBtn.addEventListener('click', closePanel);

    document.body.appendChild(panel);
    document.body.appendChild(btn);
  }

  // ─── Auto-resize: listen for height messages from embedded forms ──────────

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'lp-resize') return;
    var height = e.data.height;
    if (typeof height !== 'number' || height <= 0) return;
    // Find the inline iframe whose contentWindow sent this message
    var iframes = document.querySelectorAll('iframe[src*="/f/"]');
    for (var i = 0; i < iframes.length; i++) {
      if (iframes[i].contentWindow === e.source) {
        iframes[i].style.height = height + 'px';
        break;
      }
    }
  });

  // ─── Boot ─────────────────────────────────────────────────────────────────

  function boot() {
    // Script-tag inline mode
    if (document.querySelectorAll('script[data-form-id]').length) {
      initInline();
    }
    // Widget / floating mode
    var cfg = window.lpProConfig;
    if (cfg && cfg.formId) {
      initWidget(cfg);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
